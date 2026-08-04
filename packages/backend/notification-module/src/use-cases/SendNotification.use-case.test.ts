/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'

import { SendNotificationUseCase } from './SendNotification.use-case'
import {
  buildDeviceRow,
  buildPreferenceRow,
  buildTemplateRow,
  createInMemoryDeliveries,
  createInMemoryDevices,
  createInMemoryNotifications,
  createInMemoryPreferences,
  createInMemorySuppressions,
  createInMemoryTemplates,
  createRecordingQueue,
} from '../testing/inMemoryRepositories'
import { createDefaultTemplateRenderer } from '../shared/DefaultTemplateRenderer'
import { hashTarget } from '../shared/targetPrivacy'

const COMPANY_ID = randomUUID()
const USER_ID = randomUUID()
const HMAC_KEY = 'chave-de-teste'
const NOW = new Date('2026-08-02T15:00:00.000Z') // 12:00 em São Paulo — fora de qualquer quiet hours

function buildUseCase(
  options: {
    templates?: ReturnType<typeof createInMemoryTemplates>
    preferences?: ReturnType<typeof createInMemoryPreferences>
    devices?: ReturnType<typeof createInMemoryDevices>
    suppressions?: ReturnType<typeof createInMemorySuppressions>
    channels?: Record<string, unknown>
    recipient?: { email?: string; phone?: string; locale?: string } | undefined
  } = {},
) {
  const notifications = createInMemoryNotifications()
  const deliveries = createInMemoryDeliveries()
  const queue = createRecordingQueue()
  const templates =
    options.templates ??
    createInMemoryTemplates([
      buildTemplateRow({ companyId: COMPANY_ID, key: 'order.shipped', channel: 'inbox' }),
      buildTemplateRow({ companyId: COMPANY_ID, key: 'order.shipped', channel: 'push' }),
      buildTemplateRow({ companyId: COMPANY_ID, key: 'order.shipped', channel: 'email' }),
    ])

  const dependencies = {
    notifications,
    deliveries,
    templates,
    preferences: options.preferences ?? createInMemoryPreferences([]),
    suppressions: options.suppressions ?? createInMemorySuppressions([]),
    devices: options.devices ?? createInMemoryDevices([]),
    recipientResolver: {
      async resolve() {
        return options.recipient === undefined
          ? { email: 'cliente@example.com', phone: '5511999999999' }
          : options.recipient
      },
    },
    templateRenderer: createDefaultTemplateRenderer(),
    channels: (options.channels ?? {
      push: { driver: 'fcm', send: async () => ({ outcome: 'sent' }) },
      email: { driver: 'resend', send: async () => ({ outcome: 'sent' }) },
    }) as never,
    queue,
    clock: { now: () => NOW },
  }

  const useCase = new SendNotificationUseCase(dependencies as never, {
    defaultLocale: 'pt-BR',
    suppressionHmacKey: HMAC_KEY,
  })

  return { useCase, notifications, deliveries, queue }
}

const baseParams = {
  companyId: COMPANY_ID,
  recipientUserId: USER_ID,
  category: 'order_status',
  templateKey: 'order.shipped',
  payload: { name: 'Ana' },
}

describe('SendNotificationUseCase — idempotência', () => {
  it('mesmo dedupeKey duas vezes cria UMA notificação e devolve deduplicated na segunda', async () => {
    const { useCase, notifications } = buildUseCase()

    const first = await useCase.execute({ ...baseParams, dedupeKey: 'order:1:shipped', channels: ['inbox'] })
    const second = await useCase.execute({ ...baseParams, dedupeKey: 'order:1:shipped', channels: ['inbox'] })

    expect(first.deduplicated).toBe(false)
    expect(second.deduplicated).toBe(true)
    expect(second.notificationId).toBe(first.notificationId)
    expect(notifications.rows).toHaveLength(1)
  })
})

describe('SendNotificationUseCase — fan-out', () => {
  it('sem canais explícitos, resolve pelas preferências e registra o canal desligado como skipped', async () => {
    const preferences = createInMemoryPreferences([
      buildPreferenceRow({
        companyId: COMPANY_ID,
        userId: USER_ID,
        category: 'order_status',
        channel: 'email',
        enabled: false,
      }),
    ])
    const { useCase, deliveries } = buildUseCase({ preferences })

    await useCase.execute(baseParams)

    const byChannel = Object.fromEntries(deliveries.rows.map((row) => [row.channel, row.status]))
    expect(byChannel.inbox).toBe('sent')
    // `email` desligado na preferência nem aparece — o fan-out não o considera candidato.
    expect(byChannel.email).toBeUndefined()
  })

  it('inbox é gravado mesmo quando o push não tem device ativo', async () => {
    const { useCase, deliveries } = buildUseCase({ devices: createInMemoryDevices([]) })

    await useCase.execute({ ...baseParams, channels: ['inbox', 'push'] })

    const inbox = deliveries.rows.find((row) => row.channel === 'inbox')
    const push = deliveries.rows.find((row) => row.channel === 'push')
    expect(inbox?.status).toBe('sent')
    expect(push?.status).toBe('skipped')
    expect(push?.errorCode).toBe('no_active_device')
  })

  it('push cria uma delivery por device ativo, cada uma com seu deviceId', async () => {
    const devices = createInMemoryDevices([
      buildDeviceRow({ companyId: COMPANY_ID, userId: USER_ID }),
      buildDeviceRow({ companyId: COMPANY_ID, userId: USER_ID, platform: 'ios' }),
    ])
    const { useCase, deliveries, queue } = buildUseCase({ devices })

    await useCase.execute({ ...baseParams, channels: ['push'] })

    const pushRows = deliveries.rows.filter((row) => row.channel === 'push')
    expect(pushRows).toHaveLength(2)
    expect(new Set(pushRows.map((row) => row.deviceId)).size).toBe(2)
    // Cada job carrega o deliveryId específico — sem isso o worker não saberia qual das duas
    // entregas ele representa.
    expect(queue.enqueued.map((entry) => entry.job.deliveryId).sort()).toEqual(pushRows.map((row) => row.id).sort())
  })
})

describe('SendNotificationUseCase — supressão e template', () => {
  it('endereço suprimido nunca é tentado e a delivery nasce skipped', async () => {
    const suppressions = createInMemorySuppressions([
      {
        companyId: COMPANY_ID,
        channel: 'email',
        targetHash: hashTarget({ address: 'cliente@example.com', key: HMAC_KEY }),
      },
    ])
    const { useCase, deliveries, queue } = buildUseCase({ suppressions })

    await useCase.execute({ ...baseParams, channels: ['email'] })

    const email = deliveries.rows.find((row) => row.channel === 'email')
    expect(email?.status).toBe('skipped')
    expect(email?.errorCode).toBe('suppressed')
    expect(queue.enqueued).toHaveLength(0)
  })

  it('WhatsApp sem template aprovado é pulado, não enfileirado', async () => {
    const templates = createInMemoryTemplates([
      buildTemplateRow({ companyId: COMPANY_ID, key: 'order.shipped', channel: 'inbox' }),
      buildTemplateRow({
        companyId: COMPANY_ID,
        key: 'order.shipped',
        channel: 'whatsapp',
        whatsappTemplateName: null,
      }),
    ])
    const { useCase, deliveries, queue } = buildUseCase({
      templates,
      channels: { whatsapp: { send: async () => ({ outcome: 'sent' }) } },
    })

    await useCase.execute({ ...baseParams, channels: ['whatsapp'] })

    const whatsapp = deliveries.rows.find((row) => row.channel === 'whatsapp')
    expect(whatsapp?.status).toBe('skipped')
    expect(whatsapp?.errorCode).toBe('whatsapp_template_required')
    expect(queue.enqueued).toHaveLength(0)
  })

  it('e-mail guarda só o endereço mascarado, nunca em claro', async () => {
    const { useCase, deliveries } = buildUseCase()

    await useCase.execute({ ...baseParams, channels: ['email'] })

    const email = deliveries.rows.find((row) => row.channel === 'email')
    expect(email?.targetMasked).toBe('c******@example.com')
    expect(JSON.stringify(deliveries.rows)).not.toContain('cliente@example.com')
  })
})

describe('SendNotificationUseCase — agendamento', () => {
  it('scheduledFor no futuro cria a notificação como scheduled e não dispara nada ainda', async () => {
    const { useCase, notifications, deliveries, queue } = buildUseCase()

    const result = await useCase.execute({
      ...baseParams,
      scheduledFor: new Date(NOW.getTime() + 60 * 60 * 1000),
    })

    expect(notifications.rows[0]?.status).toBe('scheduled')
    expect(result.deliveries).toHaveLength(0)
    expect(deliveries.rows).toHaveLength(0)
    expect(queue.enqueued).toHaveLength(0)
  })
})
