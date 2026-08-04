/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Um canal por vez: supressão → throttle → template → regras específicas do canal → cria
 * `delivery` + enfileira. Extraído de `dispatchDeliveries.ts` pelo mesmo motivo que aquele saiu
 * de `SendNotification.use-case.ts` — limite de 200 linhas por arquivo.
 */

import { NOTIFICATION_CHANNEL, type NotificationChannel } from '@adatechnology/notification-contracts'

import type { DeliveryRow, DeviceRow, NotificationRow } from '../schema/schema'
import type { PlannedChannel } from '../shared/planDeliveries'
import { hashTarget, maskTarget } from '../shared/targetPrivacy'
import { isThrottled } from '../shared/throttle'
import type { SendNotificationConfig, SendNotificationDependencies } from './sendNotification.types'

const CHANNELS_WITH_SUPPRESSIBLE_ADDRESS: ReadonlySet<NotificationChannel> = new Set([
  NOTIFICATION_CHANNEL.EMAIL,
  NOTIFICATION_CHANNEL.WHATSAPP,
  NOTIFICATION_CHANNEL.SMS,
])

const DEFAULT_PUSH_THROTTLE_PER_HOUR = 10

function resolveAddress(params: { channel: NotificationChannel; email?: string; phone?: string }): string | undefined {
  if (params.channel === NOTIFICATION_CHANNEL.EMAIL) return params.email
  if (params.channel === NOTIFICATION_CHANNEL.WHATSAPP || params.channel === NOTIFICATION_CHANNEL.SMS)
    return params.phone
  return undefined
}

function delaySecondsOf(scheduledFor: Date | undefined, now: Date): number | undefined {
  if (!scheduledFor) return undefined
  return Math.max(0, Math.round((scheduledFor.getTime() - now.getTime()) / 1000))
}

async function dispatchPush(params: {
  dependencies: SendNotificationDependencies
  notification: NotificationRow
  delaySeconds?: number
}): Promise<DeliveryRow[]> {
  const { dependencies, notification } = params
  const activeDevices = await dependencies.devices.listActiveByUser({
    companyId: notification.companyId,
    userId: notification.recipientUserId,
  })

  if (activeDevices.length === 0) {
    return [
      await dependencies.deliveries.create({
        notificationId: notification.id,
        companyId: notification.companyId,
        channel: NOTIFICATION_CHANNEL.PUSH,
        status: 'skipped',
        errorCode: 'no_active_device',
      }),
    ]
  }

  // Um device por delivery — cada aparelho tem seu próprio token e sua própria chance de acabar
  // com token morto, e `DispatchDelivery` precisa saber qual `deviceId` desativar.
  return Promise.all(
    activeDevices.map((device: DeviceRow) =>
      dependencies.deliveries
        .create({
          notificationId: notification.id,
          companyId: notification.companyId,
          channel: NOTIFICATION_CHANNEL.PUSH,
          driver: device.driver,
          deviceId: device.id,
          status: 'queued',
        })
        .then(async (delivery) => {
          await dependencies.queue.enqueue({
            job: {
              notificationId: notification.id,
              deliveryId: delivery.id,
              companyId: notification.companyId,
              channel: NOTIFICATION_CHANNEL.PUSH,
              attempt: 0,
            },
            delaySeconds: params.delaySeconds,
          })
          return delivery
        }),
    ),
  )
}

export async function dispatchChannel(params: {
  dependencies: SendNotificationDependencies
  config: SendNotificationConfig
  notification: NotificationRow
  // Tipo largo (`PlannedChannel` inclui `action: 'skip'`) de propósito: o chamador já filtrou
  // `skip` e `inbox` antes de chegar aqui via `continue`; exigir o tipo estreito só reintroduziria
  // um erro de narrowing que o TS não resolve sozinho através de duas checagens sequenciais em
  // `for...of`.
  planned: PlannedChannel
  recipient: { email?: string; phone?: string }
  locale: string
  now: Date
}): Promise<DeliveryRow[]> {
  const { dependencies, config, notification, planned, recipient, locale, now } = params
  const skip = (errorCode: string, targetMasked?: string) => [
    dependencies.deliveries.create({
      notificationId: notification.id,
      companyId: notification.companyId,
      channel: planned.channel,
      targetMasked,
      status: 'skipped',
      errorCode,
    }),
  ]

  if (CHANNELS_WITH_SUPPRESSIBLE_ADDRESS.has(planned.channel)) {
    const address = resolveAddress({ channel: planned.channel, email: recipient.email, phone: recipient.phone })
    if (!address) return Promise.all(skip('recipient_unresolved'))

    const targetHash = hashTarget({ address, key: config.suppressionHmacKey })
    const suppressed = await dependencies.suppressions.isSuppressed({
      companyId: notification.companyId,
      channel: planned.channel,
      targetHash,
    })
    if (suppressed) return Promise.all(skip('suppressed', maskTarget(address)))
  }

  const throttled = await isThrottled({
    cache: dependencies.cache,
    companyId: notification.companyId,
    userId: notification.recipientUserId,
    channel: planned.channel,
    limitPerHour: config.throttlePerHour?.[planned.channel] ?? DEFAULT_PUSH_THROTTLE_PER_HOUR,
  })
  if (throttled) return Promise.all(skip('throttled'))

  const template = await dependencies.templates.findActive({
    companyId: notification.companyId,
    key: notification.templateKey,
    channel: planned.channel,
    locale,
  })
  if (!template) return Promise.all(skip('template_not_found'))

  if (planned.channel === NOTIFICATION_CHANNEL.WHATSAPP && !template.whatsappTemplateName) {
    // Regra §10.7 — sem template aprovado, não tentamos texto livre fora da janela de 24h; quem
    // sabe se está dentro da janela é a Graph API, não este pacote (ver whatsappDriver.ts).
    return Promise.all(skip('whatsapp_template_required'))
  }

  if (planned.channel === NOTIFICATION_CHANNEL.PUSH) {
    return dispatchPush({ dependencies, notification, delaySeconds: delaySecondsOf(planned.scheduledFor, now) })
  }

  const address = resolveAddress({ channel: planned.channel, email: recipient.email, phone: recipient.phone })
  const delivery = await dependencies.deliveries.create({
    notificationId: notification.id,
    companyId: notification.companyId,
    channel: planned.channel,
    targetMasked: address ? maskTarget(address) : undefined,
    status: 'queued',
  })
  await dependencies.queue.enqueue({
    job: {
      notificationId: notification.id,
      deliveryId: delivery.id,
      companyId: notification.companyId,
      channel: planned.channel,
      attempt: 0,
    },
    delaySeconds: delaySecondsOf(planned.scheduledFor, now),
  })
  return [delivery]
}
