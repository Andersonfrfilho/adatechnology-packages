/**
 * Integração real contra Postgres: prova que gravar o motivo da recusa não apaga o que a coluna
 * `payload` já guardava.
 *
 * O merge é feito em SQL (`coalesce(payload,'{}'::jsonb) || ...`), e SQL escrito à mão é
 * exatamente o tipo de coisa que passa no typecheck e falha em produção. Um `set({ payload })`
 * comum sobrescreveria — e a linha em que se quer os dois juntos, conteúdo e falha, é justamente
 * a que ficaria só com a falha.
 *
 * Sem `DRIZZLE_TEST_DATABASE_URL`/`DATABASE_URL` a suíte é pulada, no mesmo padrão do resto do
 * pacote: Postgres não é pré-requisito para `bun test` local.
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

const RECUSA_POR_PAIS = {
  code: 130497,
  title: 'Business account is restricted from messaging users in this country.',
}

describeWithDatabase('MessageRepository.updateMessageStatus grava o motivo da recusa', () => {
  let sql: SQL
  let db: MetaWhatsAppDatabase
  let repository: MessageRepository
  let sessionRepository: SessionRepository
  const companyId = crypto.randomUUID()

  async function insertOutbound(params: {
    whatsappNumber: string
    waMessageId: string
    payload?: Record<string, unknown>
  }): Promise<void> {
    const session = await sessionRepository.getOrCreate(companyId, params.whatsappNumber, 'start')
    await repository.insertMessage({
      companyId,
      sessionId: session.id,
      whatsappNumber: params.whatsappNumber,
      direction: 'outbound',
      sender: 'bot',
      type: 'text',
      content: 'Seu pedido saiu para entrega',
      payload: params.payload ?? null,
      waMessageId: params.waMessageId,
      status: 'sent',
    })
  }

  async function readPayload(waMessageId: string): Promise<Record<string, unknown> | null> {
    const [row] = await db
      .select({ payload: messages.payload })
      .from(messages)
      .where(eq(messages.waMessageId, waMessageId))
      .limit(1)
    return row?.payload ?? null
  }

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
    sessionRepository = new SessionRepository(db)
  })

  afterAll(async () => {
    await db.delete(messages).where(eq(messages.companyId, companyId))
    await db.delete(sessions).where(eq(sessions.companyId, companyId))
    await sql.end()
  })

  test('preserva o que o envio já tinha gravado em payload', async () => {
    const waMessageId = `wamid.integration-${crypto.randomUUID()}`
    await insertOutbound({
      whatsappNumber: '5511900000101',
      waMessageId,
      payload: { templateName: 'pedido_a_caminho' },
    })

    await repository.updateMessageStatus({
      companyId,
      waMessageId,
      status: 'failed',
      deliveryError: RECUSA_POR_PAIS,
    })

    const payload = await readPayload(waMessageId)
    expect(payload?.templateName).toBe('pedido_a_caminho')
    expect((payload?.deliveryError as { code?: number } | undefined)?.code).toBe(130497)
  })

  test('payload nulo vira objeto com o motivo, sem estourar no merge', async () => {
    const waMessageId = `wamid.integration-${crypto.randomUUID()}`
    await insertOutbound({ whatsappNumber: '5511900000102', waMessageId })

    const updated = await repository.updateMessageStatus({
      companyId,
      waMessageId,
      status: 'failed',
      deliveryError: RECUSA_POR_PAIS,
    })

    expect(updated?.status).toBe('failed')
    expect((await readPayload(waMessageId))?.deliveryError).toBeDefined()
  })

  test('entrega que deu certo não escreve nada em payload', async () => {
    const waMessageId = `wamid.integration-${crypto.randomUUID()}`
    await insertOutbound({ whatsappNumber: '5511900000103', waMessageId, payload: { templateName: 'x' } })

    await repository.updateMessageStatus({ companyId, waMessageId, status: 'delivered' })

    const payload = await readPayload(waMessageId)
    expect(payload).toEqual({ templateName: 'x' })
  })

  test('linha gravada torta (escalar string) volta a ser objeto na escrita', async () => {
    const waMessageId = `wamid.integration-${crypto.randomUUID()}`
    await insertOutbound({
      whatsappNumber: '5511900000105',
      waMessageId,
      payload: { templateName: 'pedido_a_caminho' },
    })

    // Linha como as que o `bun-sql` do drizzle 0.x gravou: jsonb de tipo `string`. O 1.x já grava `object`,
    // então a torta é forçada à mão para o teste não depender do driver.
    await sql`update meta_whatsapp.messages set payload = to_jsonb(payload::text) where wa_message_id = ${waMessageId}`
    const [antes] =
      await sql`select jsonb_typeof(payload) as tipo from meta_whatsapp.messages where wa_message_id = ${waMessageId}`
    expect(antes?.tipo).toBe('string')

    await repository.updateMessageStatus({
      companyId,
      waMessageId,
      status: 'failed',
      deliveryError: RECUSA_POR_PAIS,
    })

    const [depois] =
      await sql`select jsonb_typeof(payload) as tipo from meta_whatsapp.messages where wa_message_id = ${waMessageId}`
    expect(depois?.tipo).toBe('object')

    const payload = await readPayload(waMessageId)
    expect(payload?.templateName).toBe('pedido_a_caminho')
    expect((payload?.deliveryError as { code?: number } | undefined)?.code).toBe(130497)
  })

  test('segunda recusa do mesmo envio substitui o motivo em vez de acumular', async () => {
    const waMessageId = `wamid.integration-${crypto.randomUUID()}`
    await insertOutbound({ whatsappNumber: '5511900000104', waMessageId })

    await repository.updateMessageStatus({
      companyId,
      waMessageId,
      status: 'failed',
      deliveryError: { code: 131047, title: 'Re-engagement message' },
    })
    await repository.updateMessageStatus({
      companyId,
      waMessageId,
      status: 'failed',
      deliveryError: RECUSA_POR_PAIS,
    })

    const payload = await readPayload(waMessageId)
    expect((payload?.deliveryError as { code?: number } | undefined)?.code).toBe(130497)
  })
})
