/**
 * Integração real contra Postgres: índice único de atalho, isolamento por empresa, ordem, busca com
 * curinga literal e teto por empresa. Sem `DRIZZLE_TEST_DATABASE_URL`/`DATABASE_URL`, a suíte é
 * pulada — mesmo padrão dos outros testes de integração do módulo.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'
import {
  QuickReplyLimitReachedError,
  QuickReplyNotFoundError,
  QuickReplyShortcutTakenError,
  QUICK_REPLY_LIMITS,
} from '@adatechnology/meta-whatsapp-contracts'

import type { MetaWhatsAppDatabase } from '../database.types'
import { runMetaWhatsAppMigrations } from '../runMigrations'
import { QuickReplyRepository } from './QuickReplyRepository'

const databaseUrl = process.env.DRIZZLE_TEST_DATABASE_URL ?? process.env.DATABASE_URL
const describeWithDatabase = databaseUrl === undefined ? describe.skip : describe

describeWithDatabase('QuickReplyRepository (integração Postgres real)', () => {
  let sql: SQL
  let repository: QuickReplyRepository
  const companyId = crypto.randomUUID()
  const otherCompanyId = crypto.randomUUID()

  beforeAll(async () => {
    sql = new SQL(databaseUrl!)
    const db = drizzle({ client: sql }) as unknown as MetaWhatsAppDatabase
    await runMetaWhatsAppMigrations({
      db,
      migrate: async (target, config) => {
        await migrate(target as never, config)
      },
    })
    repository = new QuickReplyRepository(db)
  })

  afterAll(async () => {
    await sql.close()
  })

  test('cria no fim da lista e devolve na ordem; ordem explícita vale', async () => {
    const first = await repository.create({ companyId, title: 'B', shortcut: 'um', body: 'primeiro' })
    const second = await repository.create({ companyId, title: 'A', shortcut: 'dois', body: 'segundo' })
    const pinned = await repository.create({ companyId, title: 'C', shortcut: 'fim', body: 'fixo', sortOrder: 5 })
    expect(second.sortOrder).toBe(first.sortOrder + 1)

    const listed = await repository.list({ companyId })
    expect(listed.map((row) => row.shortcut)).toEqual(['um', 'dois', 'fim'])
    expect(pinned.sortOrder).toBe(5)
  })

  test('o mesmo atalho em outra empresa é permitido; na mesma, 409', async () => {
    await repository.create({ companyId: otherCompanyId, title: 'Outra', shortcut: 'um', body: 'x' })
    await expect(repository.create({ companyId, title: 'Dup', shortcut: 'um', body: 'x' })).rejects.toBeInstanceOf(
      QuickReplyShortcutTakenError,
    )
  })

  test('editar: mantém o próprio atalho, recusa o de outra resposta, mantém a ordem se omitida', async () => {
    const [target, neighbour] = await repository.list({ companyId })
    const kept = await repository.update({
      companyId,
      id: target!.id,
      title: 'Novo título',
      shortcut: target!.shortcut,
      body: 'novo',
    })
    expect(kept.title).toBe('Novo título')
    expect(kept.sortOrder).toBe(target!.sortOrder)
    expect(kept.updatedAt.getTime()).toBeGreaterThanOrEqual(target!.updatedAt.getTime())

    await expect(
      repository.update({ companyId, id: target!.id, title: 'x', shortcut: neighbour!.shortcut, body: 'x' }),
    ).rejects.toBeInstanceOf(QuickReplyShortcutTakenError)
  })

  test('editar ou apagar resposta de outra empresa é 404 e não altera nada', async () => {
    const [foreign] = await repository.list({ companyId: otherCompanyId })
    await expect(
      repository.update({ companyId, id: foreign!.id, title: 'x', shortcut: 'novo', body: 'x' }),
    ).rejects.toBeInstanceOf(QuickReplyNotFoundError)
    expect(await repository.delete(companyId, foreign!.id)).toBe(false)
    expect(await repository.get(otherCompanyId, foreign!.id)).toBeDefined()
  })

  test('a busca acha por título, atalho e texto, sem tratar % e _ como curinga', async () => {
    await repository.create({ companyId, title: 'Desconto', shortcut: 'promo', body: 'Garanta 10% hoje' })
    expect((await repository.list({ companyId, search: 'desc' })).map((row) => row.shortcut)).toEqual(['promo'])
    expect((await repository.list({ companyId, search: 'PROMO' })).length).toBe(1)
    expect((await repository.list({ companyId, search: '10%' })).length).toBe(1)
    expect((await repository.list({ companyId, search: '%' })).length).toBe(1)
    expect((await repository.list({ companyId, search: '_' })).length).toBe(0)
  })

  test('apagar remove e devolve false na segunda vez', async () => {
    const created = await repository.create({ companyId, title: 'Temp', shortcut: 'temp', body: 'x' })
    expect(await repository.delete(companyId, created.id)).toBe(true)
    expect(await repository.delete(companyId, created.id)).toBe(false)
  })

  test('empresa no teto não cria mais', async () => {
    const crowdedCompanyId = crypto.randomUUID()
    for (let index = 0; index < QUICK_REPLY_LIMITS.MAX_PER_COMPANY; index += 1) {
      await repository.create({ companyId: crowdedCompanyId, title: `t${index}`, shortcut: `a${index}`, body: 'x' })
    }
    await expect(
      repository.create({ companyId: crowdedCompanyId, title: 'extra', shortcut: 'extra', body: 'x' }),
    ).rejects.toBeInstanceOf(QuickReplyLimitReachedError)
  })
})
