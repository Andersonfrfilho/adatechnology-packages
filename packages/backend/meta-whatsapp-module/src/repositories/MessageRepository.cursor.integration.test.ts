/**
 * Integração real contra Postgres: o cursor composto `(created_at, id)` da listagem de mensagens.
 *
 * O que só o banco prova: com várias mensagens no MESMO instante (e microssegundos que o `Date` do
 * JavaScript não carrega), paginar por `before` sozinho pula ou repete linhas na virada da página; com
 * `beforeId` cada mensagem aparece exatamente uma vez.
 *
 * Sem `DRIZZLE_TEST_DATABASE_URL`/`DATABASE_URL` a suíte é pulada.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { SQL } from 'bun'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'

import type { MetaWhatsAppDatabase } from '../database.types'
import { messages, sessions } from '../schema/schema'
import { runMetaWhatsAppMigrations } from '../runMigrations'
import { MessageRepository } from './MessageRepository'
import { SessionRepository } from './SessionRepository'

const databaseUrl = process.env.DRIZZLE_TEST_DATABASE_URL ?? process.env.DATABASE_URL
const describeWithDatabase = databaseUrl === undefined ? describe.skip : describe

describeWithDatabase('MessageRepository.listByConversation — cursor composto (integração Postgres real)', () => {
  let sql: SQL
  let db: MetaWhatsAppDatabase
  let repository: MessageRepository
  const companyId = crypto.randomUUID()
  let sessionId = ''
  const WHATSAPP_NUMBER = '5511900000201'
  const SAME_INSTANT = new Date('2026-09-01T10:00:00.123Z')

  beforeAll(async () => {
    sql = new SQL(databaseUrl!)
    db = drizzle({ client: sql }) as unknown as MetaWhatsAppDatabase
    await runMetaWhatsAppMigrations({
      db,
      migrate: async (target, config) => {
        await migrate(target as never, config)
      },
    })
    repository = new MessageRepository(db)
    const session = await new SessionRepository(db).getOrCreate(companyId, WHATSAPP_NUMBER, 'start')
    sessionId = session.id

    // 7 mensagens no mesmo milissegundo, com microssegundos diferentes em 3 delas (o `Date` não os enxerga).
    const rows = Array.from({ length: 7 }, (_, index) => ({
      companyId,
      sessionId,
      whatsappNumber: WHATSAPP_NUMBER,
      direction: 'inbound',
      sender: 'customer',
      type: 'text',
      content: `m${index}`,
      createdAt: SAME_INSTANT,
    }))
    await db.insert(messages).values(rows)
    await sql.unsafe(
      `update meta_whatsapp.messages set created_at = created_at + (random() * 900 || ' microseconds')::interval
       where company_id = '${companyId}' and content in ('m1','m3','m5')`,
    )
  })

  afterAll(async () => {
    await db.delete(messages).where(eq(messages.companyId, companyId))
    await db.delete(sessions).where(eq(sessions.companyId, companyId))
    await sql.end()
  })

  async function pageAll(params: { useBeforeId: boolean }): Promise<string[]> {
    const seen: string[] = []
    let cursor: { id: string; createdAt: string } | undefined
    for (let guard = 0; guard < 10; guard += 1) {
      const page = await repository.listByConversation({
        companyId,
        sessionId,
        limit: 3,
        ...(cursor ? { before: cursor.createdAt, ...(params.useBeforeId ? { beforeId: cursor.id } : {}) } : {}),
      })
      if (page.length === 0) break
      seen.unshift(...page.map((message) => message.id))
      const oldest = page[0]!
      cursor = { id: oldest.id, createdAt: oldest.createdAt.toISOString() }
      if (page.length < 3) break
    }
    return seen
  }

  test('com beforeId, paginar devolve cada mensagem uma vez, sem pular nenhuma', async () => {
    const ids = await pageAll({ useBeforeId: true })
    expect(ids).toHaveLength(7)
    expect(new Set(ids).size).toBe(7)
  })

  test('só com before (ms) a paginação perde mensagens do mesmo instante: o que o cursor composto corrige', async () => {
    const ids = await pageAll({ useBeforeId: false })
    expect(new Set(ids).size).toBeLessThan(7)
  })

  test('beforeId desconhecido cai no before; beforeId que não é UUID é ignorado', async () => {
    const reference = new Date(SAME_INSTANT.getTime() + 1000)
    const unknown = await repository.listByConversation({
      companyId,
      sessionId,
      before: reference.toISOString(),
      beforeId: crypto.randomUUID(),
    })
    expect(unknown).toHaveLength(7)
    const invalid = await repository.listByConversation({
      companyId,
      sessionId,
      before: reference.toISOString(),
      beforeId: 'nao-e-uuid',
    })
    expect(invalid).toHaveLength(7)
  })

  test('o cursor de outra empresa não vaza: beforeId de fora não filtra nada', async () => {
    const [mine] = await repository.listByConversation({ companyId, sessionId, limit: 1 })
    const foreign = await repository.listByConversation({
      companyId: crypto.randomUUID(),
      sessionId,
      beforeId: mine!.id,
    })
    expect(foreign).toHaveLength(0)
  })
})
