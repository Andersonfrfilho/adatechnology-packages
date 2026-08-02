/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Resolve destinatário, monta o plano de canais (`planDeliveries`) e delega a cada um em
 * `channelDispatch.ts`. Extraído de `SendNotification.use-case.ts` (que ficou grande demais para
 * um arquivo só — `code-standart.md` §9, limite de 200 linhas) — chamado tanto pelo envio
 * imediato quanto por `DispatchDueNotifications` para o que estava agendado.
 */

import {
  NOTIFICATION_CHANNEL,
  RecipientUnresolvedError,
  type DeliverySummary,
  type NotificationChannel,
} from '@adatechnology/notification-contracts'

import type { DeliveryRow, NotificationRow } from '../schema/schema'
import { computeNotificationStatus } from '../shared/notificationAggregateStatus'
import { planDeliveries, type QuietHoursWindow } from '../shared/planDeliveries'
import { dispatchChannel } from './channelDispatch'
import type { SendNotificationConfig, SendNotificationDependencies } from './sendNotification.types'

export function toDeliverySummary(row: DeliveryRow): DeliverySummary {
  return {
    id: row.id,
    notificationId: row.notificationId,
    channel: row.channel as NotificationChannel,
    driver: row.driver ?? undefined,
    targetMasked: row.targetMasked ?? undefined,
    status: row.status as DeliverySummary['status'],
    attempt: row.attempt,
    providerMessageId: row.providerMessageId ?? undefined,
    errorCode: row.errorCode ?? undefined,
    sentAt: row.sentAt?.toISOString(),
    deliveredAt: row.deliveredAt?.toISOString(),
    failedAt: row.failedAt?.toISOString(),
  }
}

function buildAvailableChannels(dependencies: SendNotificationDependencies): Set<NotificationChannel> {
  const available = new Set<NotificationChannel>([NOTIFICATION_CHANNEL.INBOX])
  if (dependencies.channels.push) available.add(NOTIFICATION_CHANNEL.PUSH)
  if (dependencies.channels.email) available.add(NOTIFICATION_CHANNEL.EMAIL)
  if (dependencies.channels.whatsapp) available.add(NOTIFICATION_CHANNEL.WHATSAPP)
  if (dependencies.channels.sms) available.add(NOTIFICATION_CHANNEL.SMS)
  return available
}

function buildQuietHoursByChannel(
  preferenceRows: readonly {
    channel: string
    quietHoursStart: string | null
    quietHoursEnd: string | null
    timezone: string | null
  }[],
): Map<NotificationChannel, QuietHoursWindow> {
  const quietHoursByChannel = new Map<NotificationChannel, QuietHoursWindow>()
  for (const preference of preferenceRows) {
    if (preference.quietHoursStart && preference.quietHoursEnd && preference.timezone) {
      quietHoursByChannel.set(preference.channel as NotificationChannel, {
        start: preference.quietHoursStart,
        end: preference.quietHoursEnd,
        timezone: preference.timezone,
      })
    }
  }
  return quietHoursByChannel
}

export async function dispatchDeliveries(params: {
  dependencies: SendNotificationDependencies
  config: SendNotificationConfig
  notification: NotificationRow
  explicitChannels?: readonly NotificationChannel[]
  locale?: string
}): Promise<DeliverySummary[]> {
  const { dependencies, config, notification } = params
  const now = dependencies.clock?.now() ?? new Date()

  const recipient = await dependencies.recipientResolver.resolve({
    userId: notification.recipientUserId,
    companyId: notification.companyId,
  })
  if (!recipient) {
    // Sem canal específico ainda nesta altura — `inbox` como sentinela, já que representa "não
    // sabemos nada sobre este destinatário", não a falta de UM canal em particular.
    throw new RecipientUnresolvedError(notification.recipientUserId, NOTIFICATION_CHANNEL.INBOX)
  }

  const preferenceRows = await dependencies.preferences.listByUser({
    companyId: notification.companyId,
    userId: notification.recipientUserId,
  })

  const plan = planDeliveries({
    category: notification.category,
    explicitChannels: params.explicitChannels,
    availableChannels: buildAvailableChannels(dependencies),
    preferences: preferenceRows.map((row) => ({ category: row.category, channel: row.channel, enabled: row.enabled })),
    quietHoursByChannel: buildQuietHoursByChannel(preferenceRows),
    now,
  })

  const locale = params.locale ?? recipient.locale ?? config.defaultLocale
  const createdDeliveries: DeliveryRow[] = []

  for (const planned of plan) {
    if (planned.action === 'skip') {
      // canais); paralelizar não compensaria a perda de ordem previsível para os testes.
      createdDeliveries.push(
        await dependencies.deliveries.create({
          notificationId: notification.id,
          companyId: notification.companyId,
          channel: planned.channel,
          status: 'skipped',
          errorCode: planned.reason,
        }),
      )
      continue
    }

    if (planned.channel === NOTIFICATION_CHANNEL.INBOX) {
      createdDeliveries.push(
        await dependencies.deliveries.create({
          notificationId: notification.id,
          companyId: notification.companyId,
          channel: planned.channel,
          status: 'sent',
          sentAt: now,
        }),
      )
      continue
    }

    const rows = await dispatchChannel({ dependencies, config, notification, planned, recipient, locale, now })
    createdDeliveries.push(...rows)
  }

  // Deriva o status inicial das deliveries que acabaram de nascer — `queued` se algo ainda vai
  // ser tentado de forma assíncrona, `dispatched` se tudo já terminou (só inbox e/ou skips).
  await dependencies.notifications.updateStatus({
    companyId: notification.companyId,
    id: notification.id,
    status: computeNotificationStatus(createdDeliveries.map((row) => row.status)),
  })

  return createdDeliveries.map(toDeliverySummary)
}
