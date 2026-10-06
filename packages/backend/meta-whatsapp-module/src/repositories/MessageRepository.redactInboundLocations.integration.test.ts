/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Integração real contra Postgres: a redação do legado é SQL escrito à mão (`jsonb - 'location'`,
 * `FOR UPDATE SKIP LOCKED`), e o que ela promete — só a empresa pedida, só entrada, só antes do
 * corte, sem apagar as outras chaves do `payload` — é o tipo de coisa que passa no typecheck e
 * falha em produção, em dado pessoal e sem volta.
 *
 * Sem `DRIZZLE_TEST_DATABASE_URL`/`DATABASE_URL` a suíte é pulada, como o resto do pacote — e pular
 * não é passar.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { SQL } from 'bun'
import { eq, inArray, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'

import type { MetaWhatsAppDatabase } from '../database.types'
import { INBOUND_LOCATION_CONTENT } from '../inboundLocation.constant'
import { runMetaWhatsAppMigrations } from '../runMigrations'
import { messages, sessions } from '../schema/schema'
import {
  CountInboundLocationsUseCase,
  RedactInboundLocationsUseCase,
} from '../use-cases/RedactInboundLocations.use-case'
import { MessageRepository } from './MessageRepository'
import { SessionRepository } from './SessionRepository'

const databaseUrl = process.env.DRIZZLE_TEST_DATABASE_URL ?? process.env.DATABASE_URL
const describeWithDatabase = databaseUrl === undefined ? describe.skip : describe

const CUTOFF = new Date('2026-10-01T12:00:00.000Z')
const BEFORE_CUTOFF = new Date('2026-09-30T12:00:00.000Z')
const AFTER_CUTOFF = new Date('2026-10-02T12:00:00.000Z')
const LOCATION = { latitude: -20.5386, longitude: -47.4008, name: 'Casa', address: 'Rua Exemplo, 123' }
const REFERRED_PRODUCT = { catalog_id: 'cat-1', product_retailer_id: 'sku-1' }
const LEGACY_CONTENT = '📍 Localização: Casa'

describeWithDatabase('redação de localização gravada (legado)', () => {
  let client: SQL
  let db: MetaWhatsAppDatabase
  let repository: MessageRepository
  let sessionRepository: SessionRepository
  let countUseCase: CountInboundLocationsUseCase
  let redactUseCase: RedactInboundLocationsUseCase
  const companyA = crypto.randomUUID()
  const companyB = crypto.randomUUID()
  const ids: Record<string, string> = {}

  async function seed(params: {
    key: string
    companyId: string
    direction?: 'inbound' | 'outbound'
    type?: string
    content?: string | null
    payload?: Record<string, unknown> | null
    createdAt: Date
  }): Promise<void> {
    const number = `55119${String(Object.keys(ids).length).padStart(8, '0')}`
    const session = await sessionRepository.getOrCreate(params.companyId, number, 'start')
    const direction = params.direction ?? 'inbound'
    const row = await repository.insertMessage({
      companyId: params.companyId,
      sessionId: session.id,
      whatsappNumber: number,
      direction,
      sender: direction === 'inbound' ? 'customer' : 'bot',
      type: params.type ?? 'location',
      content: params.content === undefined ? LEGACY_CONTENT : params.content,
      payload: params.payload === undefined ? { location: LOCATION } : params.payload,
      waMessageId: `wamid.${crypto.randomUUID()}`,
      status: direction === 'inbound' ? 'received' : 'sent',
    })
    ids[params.key] = row!.id
    await db.update(messages).set({ createdAt: params.createdAt }).where(eq(messages.id, row!.id))
  }

  async function readRow(key: string) {
    const [row] = await db
      .select({
        payload: messages.payload,
        content: messages.content,
        type: messages.type,
        payloadType: sql<string | null>`jsonb_typeof(${messages.payload})`,
      })
      .from(messages)
      .where(eq(messages.id, ids[key]!))
    return row!
  }

  beforeAll(async () => {
    client = new SQL(databaseUrl!)
    db = drizzle({ client }) as unknown as MetaWhatsAppDatabase
    await runMetaWhatsAppMigrations({
      db,
      migrate: async (target, config) => {
        await migrate(target as never, config)
      },
    })
    repository = new MessageRepository(db)
    sessionRepository = new SessionRepository(db)
    countUseCase = new CountInboundLocationsUseCase(repository)
    redactUseCase = new RedactInboundLocationsUseCase(repository)

    await seed({ key: 'onlyLocation', companyId: companyA, createdAt: BEFORE_CUTOFF })
    await seed({
      key: 'withReferredProduct',
      companyId: companyA,
      payload: { location: LOCATION, referredProduct: REFERRED_PRODUCT },
      createdAt: BEFORE_CUTOFF,
    })
    await seed({
      key: 'text',
      companyId: companyA,
      type: 'text',
      content: 'oi',
      payload: null,
      createdAt: BEFORE_CUTOFF,
    })
    await seed({
      key: 'alreadyRedacted',
      companyId: companyA,
      content: INBOUND_LOCATION_CONTENT,
      payload: null,
      createdAt: BEFORE_CUTOFF,
    })
    await seed({ key: 'scalar', companyId: companyA, createdAt: BEFORE_CUTOFF })
    await client`update meta_whatsapp.messages set payload = to_jsonb(payload::text) where id = ${ids['scalar']!}`
    await seed({ key: 'outbound', companyId: companyA, direction: 'outbound', createdAt: BEFORE_CUTOFF })
    await seed({ key: 'afterCutoff', companyId: companyA, createdAt: AFTER_CUTOFF })
    await seed({ key: 'otherCompany', companyId: companyB, createdAt: BEFORE_CUTOFF })
  })

  afterAll(async () => {
    const companies = [companyA, companyB]
    await db.delete(messages).where(inArray(messages.companyId, companies))
    await db.delete(sessions).where(inArray(sessions.companyId, companies))
    await client.end()
  })

  test('conta o que a redação alcança e o que ela não consegue alcançar', async () => {
    expect(await countUseCase.execute({ companyId: companyA, receivedBefore: CUTOFF })).toEqual({
      counted: 2,
      unreachable: 1,
    })
  })

  test('lote de 1 redige uma linha por passada até zerar', async () => {
    const params = { companyId: companyA, receivedBefore: CUTOFF, batchSize: 1 }

    expect(await redactUseCase.execute(params)).toEqual({ redacted: 1 })
    expect(await redactUseCase.execute(params)).toEqual({ redacted: 1 })
    expect(await redactUseCase.execute(params)).toEqual({ redacted: 0 })
  })

  test('só-location fica sem payload e com o rótulo neutro', async () => {
    const row = await readRow('onlyLocation')

    expect(row.payload).toBeNull()
    expect(row.content).toBe(INBOUND_LOCATION_CONTENT)
    expect(row.type).toBe('location')
  })

  test('a outra chave do payload é preservada', async () => {
    const row = await readRow('withReferredProduct')

    expect(row.payload).toEqual({ referredProduct: REFERRED_PRODUCT })
    expect(row.content).toBe(INBOUND_LOCATION_CONTENT)
  })

  test('posterior ao corte, outra empresa, texto, saída e escalar ficam intactos', async () => {
    expect((await readRow('afterCutoff')).payload).toEqual({ location: LOCATION })
    expect((await readRow('afterCutoff')).content).toBe(LEGACY_CONTENT)
    expect((await readRow('otherCompany')).payload).toEqual({ location: LOCATION })
    expect((await readRow('otherCompany')).content).toBe(LEGACY_CONTENT)
    expect((await readRow('outbound')).payload).toEqual({ location: LOCATION })
    expect((await readRow('outbound')).content).toBe(LEGACY_CONTENT)
    expect(await readRow('text')).toMatchObject({ payload: null, content: 'oi' })
    expect((await readRow('alreadyRedacted')).payload).toBeNull()
    expect((await readRow('scalar')).payloadType).toBe('string')
    expect((await readRow('scalar')).content).toBe(LEGACY_CONTENT)
  })

  test('nenhuma linha vira jsonb escalar pela redação', async () => {
    const redactedKeys = ['onlyLocation', 'withReferredProduct']
    for (const key of redactedKeys) {
      expect((await readRow(key)).payloadType).not.toBe('string')
    }
  })

  test('a segunda passada devolve 0 e a contagem restante é só a inalcançável', async () => {
    expect(await redactUseCase.execute({ companyId: companyA, receivedBefore: CUTOFF })).toEqual({ redacted: 0 })
    expect(await countUseCase.execute({ companyId: companyA, receivedBefore: CUTOFF })).toEqual({
      counted: 0,
      unreachable: 1,
    })
  })

  test('a empresa B só é tocada quando é ela quem pede', async () => {
    expect(await countUseCase.execute({ companyId: companyB, receivedBefore: CUTOFF })).toEqual({
      counted: 1,
      unreachable: 0,
    })
    expect(await redactUseCase.execute({ companyId: companyB, receivedBefore: CUTOFF })).toEqual({ redacted: 1 })
    expect((await readRow('otherCompany')).payload).toBeNull()
  })
})
