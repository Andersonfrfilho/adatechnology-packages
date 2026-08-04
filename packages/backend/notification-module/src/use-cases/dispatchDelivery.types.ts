/**
 * Copyright (c) 2026 Ada Technology. MIT License.
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

import type { DeliveryRow, DeviceRow, NotificationRow, TemplateRow } from '../schema/schema'

export type DeliveryFinder = {
  findById(params: { companyId: string; id: string }): Promise<DeliveryRow | undefined>
  listByNotification(params: { companyId: string; notificationId: string }): Promise<DeliveryRow[]>
}

export type UpdateDeliveryAttemptParams = {
  companyId: string
  id: string
  status: string
  attempt?: number
  providerMessageId?: string
  errorCode?: string
  sentAt?: Date
  deliveredAt?: Date
  failedAt?: Date
}

export type DeliveryUpdater = {
  updateAttempt(params: UpdateDeliveryAttemptParams): Promise<DeliveryRow | undefined>
}

export type NotificationFinder = {
  findByIdForCompany(params: { companyId: string; id: string }): Promise<NotificationRow | undefined>
}

export type NotificationStatusWriter = {
  updateStatus(params: { companyId: string; id: string; status: string }): Promise<void>
}

export type TemplateFinder = {
  findActive(params: {
    companyId: string
    key: string
    channel: string
    locale: string
  }): Promise<TemplateRow | undefined>
}

export type DeviceFinder = {
  findById(params: { id: string }): Promise<DeviceRow | undefined>
  disable(params: { id: string; reason: string }): Promise<void>
}

export type SuppressionWriter = {
  create(params: {
    companyId: string
    channel: string
    targetHash: string
    reason: string
    expiresAt?: Date
  }): Promise<unknown>
}

export type DispatchDeliveryDependencies = {
  readonly deliveries: DeliveryFinder & DeliveryUpdater
  readonly notifications: NotificationFinder & NotificationStatusWriter
  readonly templates: TemplateFinder
  readonly devices: DeviceFinder
  readonly suppressions: SuppressionWriter
  readonly recipientResolver: RecipientResolverPort
  readonly templateRenderer: TemplateRendererPort
  readonly channels: ChannelDrivers
  readonly queue: QueuePort
  readonly cache?: CachePort
  readonly clock?: ClockPort
  readonly hooks?: NotificationHooks
  readonly logger?: LoggerPort
}

export type DispatchDeliveryConfig = {
  readonly defaultLocale: string
  readonly suppressionHmacKey: string
  readonly retryAttempts: number
  readonly retryBackoffSeconds: number
}
