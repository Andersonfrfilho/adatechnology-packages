/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type {
  CompanyId,
  DevicePlatform,
  NotificationChannel,
  NotificationId,
  NotificationStatus,
  PushDriver,
  SuppressionReason,
  UserId,
} from './notification.types'

/**
 * Eventos de domínio — os pontos de extensão do produto. É aqui que entra a regra de negócio que
 * o módulo não pode ter (ex.: bounce de e-mail marca o contato como inválido no CRM), sem
 * ninguém editar código do pacote (regra de módulos plugáveis, §3).
 */
export const NOTIFICATION_EVENT = {
  CREATED: 'notification.created',
  DISPATCHED: 'notification.dispatched',
  READ: 'notification.read',
  DELIVERY_SENT: 'delivery.sent',
  DELIVERY_FAILED: 'delivery.failed',
  DELIVERY_BOUNCED: 'delivery.bounced',
  DEVICE_REGISTERED: 'device.registered',
  DEVICE_INVALIDATED: 'device.invalidated',
  PREFERENCES_UPDATED: 'preferences.updated',
} as const
export type NotificationEvent = (typeof NOTIFICATION_EVENT)[keyof typeof NOTIFICATION_EVENT]

type BaseEvent = {
  readonly companyId: CompanyId
  readonly occurredAt: Date
}

export type NotificationCreatedEvent = BaseEvent & {
  readonly notificationId: NotificationId
  readonly recipientUserId: UserId
  readonly category: string
  readonly templateKey: string
  /** Canais que sobreviveram ao fan-out; os pulados aparecem em `skippedChannels`. */
  readonly channels: readonly NotificationChannel[]
  readonly skippedChannels: readonly { readonly channel: NotificationChannel; readonly reason: string }[]
}

export type NotificationDispatchedEvent = BaseEvent & {
  readonly notificationId: NotificationId
  readonly status: NotificationStatus
}

export type NotificationReadEvent = BaseEvent & {
  readonly notificationId: NotificationId
  readonly recipientUserId: UserId
}

export type DeliverySentEvent = BaseEvent & {
  readonly notificationId: NotificationId
  readonly deliveryId: string
  readonly channel: NotificationChannel
  readonly providerMessageId?: string
  readonly attempt: number
}

export type DeliveryFailedEvent = BaseEvent & {
  readonly notificationId: NotificationId
  readonly deliveryId: string
  readonly channel: NotificationChannel
  readonly errorCode: string
  readonly attempt: number
  /** `false` quando o retry esgotou ou o erro é permanente — é o gancho para alerta do host. */
  readonly willRetry: boolean
}

export type DeliveryBouncedEvent = BaseEvent & {
  readonly notificationId: NotificationId
  readonly deliveryId: string
  readonly channel: NotificationChannel
  readonly reason: SuppressionReason
}

export type DeviceRegisteredEvent = BaseEvent & {
  readonly deviceId: string
  readonly userId: UserId
  readonly platform: DevicePlatform
  readonly driver: PushDriver
}

export type DeviceInvalidatedEvent = BaseEvent & {
  readonly deviceId: string
  readonly userId: UserId
  readonly driver: PushDriver
  readonly errorCode: string
}

export type PreferencesUpdatedEvent = BaseEvent & {
  readonly userId: UserId
  readonly categories: readonly string[]
}

/**
 * Hooks são `void`-tolerantes de propósito: falha de hook do produto não pode derrubar a entrega
 * da notificação. O módulo loga e segue — quem precisa de garantia transacional usa a fila.
 */
export type NotificationHooks = {
  onNotificationCreated?(event: NotificationCreatedEvent): Promise<void> | void
  onNotificationDispatched?(event: NotificationDispatchedEvent): Promise<void> | void
  onNotificationRead?(event: NotificationReadEvent): Promise<void> | void
  onDeliverySent?(event: DeliverySentEvent): Promise<void> | void
  onDeliveryFailed?(event: DeliveryFailedEvent): Promise<void> | void
  onDeliveryBounced?(event: DeliveryBouncedEvent): Promise<void> | void
  onDeviceRegistered?(event: DeviceRegisteredEvent): Promise<void> | void
  onDeviceInvalidated?(event: DeviceInvalidatedEvent): Promise<void> | void
  onPreferencesUpdated?(event: PreferencesUpdatedEvent): Promise<void> | void
}
