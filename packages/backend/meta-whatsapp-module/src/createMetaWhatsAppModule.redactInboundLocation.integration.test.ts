/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Prova a LIGAÇÃO da opção: o teste do caso de uso passa mesmo que `createMetaWhatsAppModule` esqueça
 * de repassar `features.redactInboundLocation`. Aqui o webhook entra pelo módulo montado e a linha é
 * lida de volta do Postgres.
 *
 * Sem `DRIZZLE_TEST_DATABASE_URL`/`DATABASE_URL` a suíte é pulada, como o resto do pacote — e pular
 * não é passar.
 */
import { createHmac } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { SQL } from 'bun'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'
import { buildInboundLocationPayload, serializeWebhookPayload } from '@adatechnology/meta-whatsapp-contracts/testing'

import { createMetaWhatsAppModule } from './createMetaWhatsAppModule'
import type { MetaWhatsAppDatabase } from './database.types'
import { INBOUND_LOCATION_CONTENT } from './inboundLocation.constant'
import { runMetaWhatsAppMigrations } from './runMigrations'
import { messages, sessions } from './schema/schema'

const databaseUrl = process.env.DRIZZLE_TEST_DATABASE_URL ?? process.env.DATABASE_URL
const describeWithDatabase = databaseUrl === undefined ? describe.skip : describe

const APP_SECRET = 'segredo-do-app'
const PHONE_NUMBER_ID = '1129051206965973'
const LOCATION = {
  latitude: -20.5386,
  longitude: -47.4008,
  name: 'Casa',
  address: 'Rua Exemplo, 123',
  url: 'https://maps.example/?q=-20.5386,-47.4008',
} as const

describeWithDatabase('createMetaWhatsAppModule — features.redactInboundLocation', () => {
  let sql: SQL
  let db: MetaWhatsAppDatabase
  const companyIds: string[] = []

  function createModule(redactInboundLocation: boolean | undefined) {
    return createMetaWhatsAppModule({
      db,
      config: {
        phoneNumberId: PHONE_NUMBER_ID,
        accessToken: 'token',
        webhookVerifyToken: 'verify',
        appSecret: APP_SECRET,
      },
      nonceStore: {
        async setIfAbsent() {
          return true
        },
        async confirm() {},
      },
      features: {
        flowEngine: false,
        ...(redactInboundLocation === undefined ? {} : { redactInboundLocation }),
      },
    })
  }

  async function receiveLocation(redactInboundLocation: boolean | undefined) {
    const companyId = crypto.randomUUID()
    companyIds.push(companyId)
    const webhookPayload = buildInboundLocationPayload({
      from: '5516999999999',
      phoneNumberId: PHONE_NUMBER_ID,
      latitude: LOCATION.latitude,
      longitude: LOCATION.longitude,
    })
    webhookPayload.entry[0]!.changes[0]!.value.messages![0]!.location = { ...LOCATION }
    const rawBody = serializeWebhookPayload(webhookPayload)

    await createModule(redactInboundLocation).webhook.receive.execute({
      companyId,
      rawBody,
      signatureHeader: `sha256=${createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')}`,
    })

    const [row] = await db.select().from(messages).where(eq(messages.companyId, companyId))
    return row
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
  })

  afterAll(async () => {
    for (const companyId of companyIds) {
      await db.delete(messages).where(eq(messages.companyId, companyId))
      await db.delete(sessions).where(eq(sessions.companyId, companyId))
    }
    await sql.end()
  })

  test('ligada: a linha gravada não tem a coordenada nem o rótulo', async () => {
    const row = await receiveLocation(true)

    expect(row?.type).toBe('location')
    expect(row?.payload).toBeNull()
    expect(row?.content).toBe(INBOUND_LOCATION_CONTENT)
  })

  test('sem a opção: comportamento da 0.7.0', async () => {
    const row = await receiveLocation(undefined)

    expect(row?.payload).toEqual({ location: { ...LOCATION } })
    expect(row?.content).toBe('📍 Localização: Casa')
  })
})
