/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'

import { applyDeliveryOutcome } from './applyDeliveryOutcome'
import {
  buildDeviceRow,
  createInMemoryDeliveries,
  createInMemoryDevices,
  createInMemoryNotifications,
  createInMemorySuppressions,
  createRecordingQueue,
} from '../testing/inMemoryRepositories'
import { hashTarget } from '../shared/targetPrivacy'

const COMPANY_ID = randomUUID()
const USER_ID = randomUUID()
const HMAC_KEY = 'chave-de-teste'
const NOW = new Date('2026-08-02T15:00:00.000Z')

const config = {
  defaultLocale: 'pt-BR',
  suppressionHmacKey: HMAC_KEY,
  retryAttempts: 3,
  retryBackoffSeconds: 30,
}

async function buildScenario(options: {
  channel: string
  deviceId?: string | null
  attempt?: number
  devices?: ReturnType<typeof createInMemoryDevices>
}) {
  const notifications = createInMemoryNotifications()
  const deliveries = createInMemoryDeliveries()
  const suppressions = createInMemorySuppressions([])
  const queue = createRecordingQueue()
  const devices = options.devices ?? createInMemoryDevices([])

  const notification = await notifications.create({
    companyId: COMPANY_ID,
    recipientUserId: USER_ID,
    category: 'order_status',
    templateKey: 'order.shipped',
    title: 'Pedido enviado',
    body: 'Seu pedido saiu',
  })
  const delivery = await deliveries.create({
    notificationId: notification.id,
    companyId: COMPANY_ID,
    channel: options.channel,
    deviceId: options.deviceId ?? null,
    driver: options.channel === 'push' ? 'fcm' : null,
    attempt: options.attempt ?? 0,
    status: 'queued',
  })

  const dependencies = { notifications, deliveries, devices, suppressions, queue, clock: { now: () => NOW } } as never

  return { dependencies, notifications, deliveries, devices, suppressions, queue, notification, delivery }
}

describe('applyDeliveryOutcome — sent', () => {
  it('grava o id do provedor e marca a notificação como dispatched', async () => {
    const scenario = await buildScenario({ channel: 'email' })

    await applyDeliveryOutcome({
      dependencies: scenario.dependencies,
      config,
      delivery: scenario.delivery,
      notification: scenario.notification,
      outcome: { outcome: 'sent', providerMessageId: 'email_123' },
      now: NOW,
    })

    expect(scenario.deliveries.rows[0]?.status).toBe('sent')
    expect(scenario.deliveries.rows[0]?.providerMessageId).toBe('email_123')
    expect(scenario.notifications.rows[0]?.status).toBe('dispatched')
  })
})

describe('applyDeliveryOutcome — retriable', () => {
  it('reagenda com backoff e mantém a delivery em queued enquanto houver tentativa', async () => {
    const scenario = await buildScenario({ channel: 'email', attempt: 0 })

    await applyDeliveryOutcome({
      dependencies: scenario.dependencies,
      config,
      delivery: scenario.delivery,
      notification: scenario.notification,
      outcome: { outcome: 'retriable', errorCode: 'http_503' },
      now: NOW,
    })

    expect(scenario.deliveries.rows[0]?.status).toBe('queued')
    expect(scenario.deliveries.rows[0]?.attempt).toBe(1)
    expect(scenario.queue.enqueued).toHaveLength(1)
    expect(scenario.queue.enqueued[0]?.job.attempt).toBe(1)
  })

  it('respeita retryAfterSeconds do driver quando ele informa', async () => {
    const scenario = await buildScenario({ channel: 'email' })

    await applyDeliveryOutcome({
      dependencies: scenario.dependencies,
      config,
      delivery: scenario.delivery,
      notification: scenario.notification,
      outcome: { outcome: 'retriable', errorCode: 'rate_limited', retryAfterSeconds: 42 },
      now: NOW,
    })

    expect(scenario.queue.enqueued[0]?.delaySeconds).toBe(42)
  })

  it('na última tentativa vira failed e para de reenfileirar', async () => {
    const scenario = await buildScenario({ channel: 'email', attempt: config.retryAttempts - 1 })

    await applyDeliveryOutcome({
      dependencies: scenario.dependencies,
      config,
      delivery: scenario.delivery,
      notification: scenario.notification,
      outcome: { outcome: 'retriable', errorCode: 'http_503' },
      now: NOW,
    })

    expect(scenario.deliveries.rows[0]?.status).toBe('failed')
    expect(scenario.queue.enqueued).toHaveLength(0)
    expect(scenario.notifications.rows[0]?.status).toBe('failed')
  })
})

describe('applyDeliveryOutcome — invalid_target', () => {
  it('token morto desativa o device e NÃO gera retry', async () => {
    const device = buildDeviceRow({ companyId: COMPANY_ID, userId: USER_ID })
    const devices = createInMemoryDevices([device])
    const scenario = await buildScenario({ channel: 'push', deviceId: device.id, devices })

    await applyDeliveryOutcome({
      dependencies: scenario.dependencies,
      config,
      delivery: scenario.delivery,
      notification: scenario.notification,
      outcome: { outcome: 'invalid_target', errorCode: 'messaging/registration-token-not-registered' },
      now: NOW,
    })

    // O `disabledAt` exato vem do repositório real (`new Date()`), não do clock injetado — aqui
    // só importa que o device saiu de ativo, com o código do provedor registrado como motivo.
    expect(scenario.devices.rows[0]?.disabledAt).not.toBeNull()
    expect(scenario.devices.rows[0]?.disabledReason).toBe('messaging/registration-token-not-registered')
    expect(scenario.deliveries.rows[0]?.status).toBe('failed')
    expect(scenario.queue.enqueued).toHaveLength(0)
  })

  it('endereço inválido cria supressão pelo hash, nunca pelo endereço em claro', async () => {
    const scenario = await buildScenario({ channel: 'email' })

    await applyDeliveryOutcome({
      dependencies: scenario.dependencies,
      config,
      delivery: scenario.delivery,
      notification: scenario.notification,
      outcome: { outcome: 'invalid_target', errorCode: 'smtp_550' },
      address: 'cliente@example.com',
      now: NOW,
    })

    expect(scenario.suppressions.rows).toHaveLength(1)
    expect(scenario.suppressions.rows[0]?.targetHash).toBe(
      hashTarget({ address: 'cliente@example.com', key: HMAC_KEY }),
    )
    expect(JSON.stringify(scenario.suppressions.rows)).not.toContain('cliente@example.com')
    expect(scenario.queue.enqueued).toHaveLength(0)
  })
})

describe('applyDeliveryOutcome — permanent', () => {
  it('falha na primeira tentativa, sem retry e sem suprimir nada', async () => {
    const scenario = await buildScenario({ channel: 'email' })

    await applyDeliveryOutcome({
      dependencies: scenario.dependencies,
      config,
      delivery: scenario.delivery,
      notification: scenario.notification,
      outcome: { outcome: 'permanent', errorCode: 'invalid_from_address' },
      address: 'cliente@example.com',
      now: NOW,
    })

    expect(scenario.deliveries.rows[0]?.status).toBe('failed')
    expect(scenario.deliveries.rows[0]?.errorCode).toBe('invalid_from_address')
    expect(scenario.suppressions.rows).toHaveLength(0)
    expect(scenario.queue.enqueued).toHaveLength(0)
  })
})
