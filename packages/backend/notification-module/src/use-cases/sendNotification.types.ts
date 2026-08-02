/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Portas estreitas (duck-typed) para os repositórios usados por `SendNotification` e
 * `dispatchDeliveries` — não a classe concreta do repositório. Testes injetam um dublê em
 * memória que satisfaz só os métodos daqui, sem precisar de Postgres (mesmo padrão de
 * `quickcart/.../ProcessNotificationJob.use-case.ts`).
 */

import type {
  CachePort,
  ChannelDrivers,
  ClockPort,
  LoggerPort,
  NotificationHooks,
  QueuePort,
  RecipientResolverPort,
  TemplateRendererPort,
} from '@adatechnology/notification-contracts'

import type {
  DeliveryRow,
  DeviceRow,
  NewDeliveryRow,
  NewNotificationRow,
  NotificationRow,
  PreferenceRow,
  TemplateRow,
} from '../schema/schema'

export type NotificationWriter = {
  create(values: NewNotificationRow): Promise<NotificationRow>
  findByDedupeKey(params: { companyId: string; dedupeKey: string }): Promise<NotificationRow | undefined>
  updateStatus(params: { companyId: string; id: string; status: string }): Promise<void>
}

export type DeliveryWriter = {
  create(values: NewDeliveryRow): Promise<DeliveryRow>
  listByNotification(params: { companyId: string; notificationId: string }): Promise<DeliveryRow[]>
}

export type TemplateFinder = {
  findActive(params: {
    companyId: string
    key: string
    channel: string
    locale: string
  }): Promise<TemplateRow | undefined>
}

export type PreferenceLister = {
  listByUser(params: { companyId: string; userId: string }): Promise<PreferenceRow[]>
}

export type SuppressionChecker = {
  isSuppressed(params: { companyId: string; channel: string; targetHash: string }): Promise<boolean>
}

export type ActiveDeviceLister = {
  listActiveByUser(params: { companyId: string; userId: string }): Promise<DeviceRow[]>
}

export type SendNotificationDependencies = {
  readonly notifications: NotificationWriter
  readonly deliveries: DeliveryWriter
  readonly templates: TemplateFinder
  readonly preferences: PreferenceLister
  readonly suppressions: SuppressionChecker
  readonly devices: ActiveDeviceLister
  readonly recipientResolver: RecipientResolverPort
  readonly templateRenderer: TemplateRendererPort
  readonly channels: ChannelDrivers
  readonly queue: QueuePort
  readonly cache?: CachePort
  readonly clock?: ClockPort
  readonly hooks?: NotificationHooks
  readonly logger?: LoggerPort
}

export type SendNotificationConfig = {
  readonly defaultLocale: string
  readonly suppressionHmacKey: string
  readonly throttlePerHour?: Partial<Record<string, number>>
}
