/**
 * Integração real contra Postgres: prova que `takeover`/`release` limpam `humanRequestedAt`.
 *
 * Antes desta correção, `takeover`/`release` só mexiam em `mode`/`assignedUserId` (via
 * `setMode`), e `humanRequestedAt` nunca voltava a null. Como `listByContextFilters` calcula
 * `waitingHuman` só por `humanRequestedAt is not null`, a conversa ficava para sempre na fila
 * "aguardando atendimento" da inbox, mesmo depois de um atendente assumir e devolver ao bot.
 *
 * Sem `DRIZZLE_TEST_DATABASE_URL`/`DATABASE_URL`, a suíte inteira é pulada — mesmo padrão de
 * `scheduling-module`/`drizzle-provider`: Postgres não é pré-requisito para `bun test` local.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { SQL } from 'bun'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'

import type { MetaWhatsAppDatabase } from '../database.types'
import { sessions } from '../schema/schema'
import { runMetaWhatsAppMigrations } from '../runMigrations'
import { SessionRepository } from './SessionRepository'

const databaseUrl = process.env.DRIZZLE_TEST_DATABASE_URL ?? process.env.DATABASE_URL
const describeWithDatabase = databaseUrl === undefined ? describe.skip : describe

describeWithDatabase('SessionRepository.takeover/release limpam humanRequestedAt (integração Postgres real)', () => {
  let sql: SQL
  let db: MetaWhatsAppDatabase
  let repository: SessionRepository
  const companyId = crypto.randomUUID()

  async function isWaitingHuman(whatsappNumber: string): Promise<boolean> {
    const [row] = await db
      .select({ humanRequestedAt: sessions.humanRequestedAt })
      .from(sessions)
      .where(and(eq(sessions.companyId, companyId), eq(sessions.whatsappNumber, whatsappNumber)))
      .limit(1)
    return row?.humanRequestedAt !== null && row?.humanRequestedAt !== undefined
  }

  beforeAll(async () => {
    sql = new SQL(databaseUrl!)
    db = drizzle(sql) as unknown as MetaWhatsAppDatabase
    await runMetaWhatsAppMigrations({ db, migrate: (target, config) => migrate(target as never, config) })
    repository = new SessionRepository(db)
  })

  afterAll(async () => {
    await db.delete(sessions).where(eq(sessions.companyId, companyId))
    await sql.end()
  })

  test('requestHuman coloca a conversa em waitingHuman', async () => {
    const whatsappNumber = '5511900000001'
    await repository.getOrCreate(companyId, whatsappNumber, 'start')

    await repository.requestHuman(companyId, whatsappNumber)

    expect(await isWaitingHuman(whatsappNumber)).toBe(true)
    const [conversation] = await repository.listByContextFilters(companyId, { waitingHuman: true })
    expect(conversation?.whatsappNumber).toBe(whatsappNumber)
  })

  test('takeover tira a conversa de waitingHuman e zera humanRequestedAt', async () => {
    const whatsappNumber = '5511900000002'
    await repository.getOrCreate(companyId, whatsappNumber, 'start')
    await repository.requestHuman(companyId, whatsappNumber)
    expect(await isWaitingHuman(whatsappNumber)).toBe(true)

    await repository.takeover(companyId, whatsappNumber, crypto.randomUUID())

    expect(await isWaitingHuman(whatsappNumber)).toBe(false)
    const waiting = await repository.listByContextFilters(companyId, { waitingHuman: true })
    expect(waiting.some((conversation) => conversation.whatsappNumber === whatsappNumber)).toBe(false)
  })

  test('takeover seguido de release: pedido novo volta a aparecer em waitingHuman', async () => {
    const whatsappNumber = '5511900000003'
    const agentUserId = crypto.randomUUID()
    await repository.getOrCreate(companyId, whatsappNumber, 'start')
    await repository.requestHuman(companyId, whatsappNumber)

    await repository.takeover(companyId, whatsappNumber, agentUserId)
    expect(await isWaitingHuman(whatsappNumber)).toBe(false)

    await repository.release(companyId, whatsappNumber)
    expect(await isWaitingHuman(whatsappNumber)).toBe(false)

    await repository.requestHuman(companyId, whatsappNumber)
    expect(await isWaitingHuman(whatsappNumber)).toBe(true)
  })

  test('release sem pedido prévio continua funcionando', async () => {
    const whatsappNumber = '5511900000004'
    await repository.getOrCreate(companyId, whatsappNumber, 'start')

    await repository.release(companyId, whatsappNumber)

    const [row] = await db
      .select({
        mode: sessions.mode,
        assignedUserId: sessions.assignedUserId,
        humanRequestedAt: sessions.humanRequestedAt,
      })
      .from(sessions)
      .where(and(eq(sessions.companyId, companyId), eq(sessions.whatsappNumber, whatsappNumber)))
      .limit(1)
    expect(row?.mode).toBe('bot')
    expect(row?.assignedUserId).toBeNull()
    expect(row?.humanRequestedAt).toBeNull()
  })
})
