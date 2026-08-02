/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
  TemplateNotFoundError,
  type DeliverySummary,
  type NotificationChannel,
  type SendNotificationParams,
  type SendNotificationResult,
} from '@adatechnology/notification-contracts'

import type { NotificationRow } from '../schema/schema'
import { dispatchDeliveries, toDeliverySummary } from './dispatchDeliveries'
import type { SendNotificationConfig, SendNotificationDependencies } from './sendNotification.types'

export type { SendNotificationDependencies, SendNotificationConfig } from './sendNotification.types'

// Ordem só para achar UM template que preencha o resumo em `notifications.title`/`body` — não é
// a ordem real de disparo (essa é decidida por `planDeliveries`, por canal, depois do
// destinatário resolvido, dentro de `dispatchDeliveries`).
const REPRESENTATIVE_CHANNEL_PRIORITY: readonly NotificationChannel[] = [
  NOTIFICATION_CHANNEL.INBOX,
  NOTIFICATION_CHANNEL.PUSH,
  NOTIFICATION_CHANNEL.EMAIL,
  NOTIFICATION_CHANNEL.WHATSAPP,
  NOTIFICATION_CHANNEL.SMS,
]

export class SendNotificationUseCase {
  constructor(
    private readonly dependencies: SendNotificationDependencies,
    private readonly config: SendNotificationConfig,
  ) {}

  private availableChannels(): ReadonlySet<NotificationChannel> {
    const available = new Set<NotificationChannel>([NOTIFICATION_CHANNEL.INBOX])
    if (this.dependencies.channels.push) available.add(NOTIFICATION_CHANNEL.PUSH)
    if (this.dependencies.channels.email) available.add(NOTIFICATION_CHANNEL.EMAIL)
    if (this.dependencies.channels.whatsapp) available.add(NOTIFICATION_CHANNEL.WHATSAPP)
    if (this.dependencies.channels.sms) available.add(NOTIFICATION_CHANNEL.SMS)
    return available
  }

  private async renderRepresentative(params: {
    companyId: string
    templateKey: string
    payload: Readonly<Record<string, unknown>>
    locale: string
  }): Promise<{ title: string; body: string }> {
    const available = this.availableChannels()
    for (const channel of REPRESENTATIVE_CHANNEL_PRIORITY) {
      if (!available.has(channel)) continue

      // canais), e para na primeira que encontra — sequencial é o comportamento certo aqui.
      const template = await this.dependencies.templates.findActive({
        companyId: params.companyId,
        key: params.templateKey,
        channel,
        locale: params.locale,
      })
      if (!template) continue

      const rendered = await this.dependencies.templateRenderer.render({
        body: template.body,
        subject: template.subject ?? undefined,
        channel,
        payload: params.payload,
        locale: params.locale,
      })
      return { title: rendered.title, body: rendered.body }
    }

    throw new TemplateNotFoundError(params.templateKey, NOTIFICATION_CHANNEL.INBOX, params.locale)
  }

  async execute(params: SendNotificationParams): Promise<SendNotificationResult> {
    const now = this.dependencies.clock?.now() ?? new Date()

    if (params.dedupeKey) {
      const existing = await this.dependencies.notifications.findByDedupeKey({
        companyId: params.companyId,
        dedupeKey: params.dedupeKey,
      })
      if (existing) {
        const existingDeliveries = await this.dependencies.deliveries.listByNotification({
          companyId: params.companyId,
          notificationId: existing.id,
        })
        return {
          notificationId: existing.id,
          deduplicated: true,
          deliveries: existingDeliveries.map(toDeliverySummary),
        }
      }
    }

    const locale = params.locale ?? this.config.defaultLocale
    const representative = await this.renderRepresentative({
      companyId: params.companyId,
      templateKey: params.templateKey,
      payload: params.payload ?? {},
      locale,
    })

    const isScheduledForLater = params.scheduledFor !== undefined && params.scheduledFor.getTime() > now.getTime()

    const notification = await this.dependencies.notifications.create({
      companyId: params.companyId,
      recipientUserId: params.recipientUserId,
      category: params.category,
      templateKey: params.templateKey,
      payload: (params.payload ?? {}) as Record<string, unknown>,
      title: representative.title,
      body: representative.body,
      dedupeKey: params.dedupeKey,
      scheduledFor: params.scheduledFor,
      status: isScheduledForLater ? NOTIFICATION_STATUS.SCHEDULED : NOTIFICATION_STATUS.PENDING,
    })

    await this.dependencies.hooks?.onNotificationCreated?.({
      companyId: params.companyId,
      occurredAt: now,
      notificationId: notification.id,
      recipientUserId: params.recipientUserId,
      category: params.category,
      templateKey: params.templateKey,
      channels: [],
      skippedChannels: [],
    })

    if (isScheduledForLater) return { notificationId: notification.id, deduplicated: false, deliveries: [] }

    const deliveries = await this.dispatchNow({
      notification,
      explicitChannels: params.channels,
      locale: params.locale,
    })
    return { notificationId: notification.id, deduplicated: false, deliveries }
  }

  /**
   * Usado também por `DispatchDueNotifications` para o que estava `scheduled` e cuja hora
   * chegou — é o mesmo caminho do envio imediato, para as duas entradas não divergirem.
   */
  async dispatchNow(params: {
    notification: NotificationRow
    explicitChannels?: readonly NotificationChannel[]
    locale?: string
  }): Promise<DeliverySummary[]> {
    return dispatchDeliveries({
      dependencies: this.dependencies,
      config: this.config,
      notification: params.notification,
      explicitChannels: params.explicitChannels,
      locale: params.locale,
    })
  }
}
