/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Camada de dados do trio (Fase 3 — schema, migrations, repositories). Composição do módulo
 * (`createNotificationModule`, use-cases, HTTP, worker) chega na Fase 4/5.
 */

export type { NotificationDatabase, DrizzleMigrateFunction } from './database.types'

export {
  notificationSchema,
  templates,
  notifications,
  deliveries,
  devices,
  preferences,
  suppressions,
} from './schema/schema'
export type {
  TemplateRow,
  NewTemplateRow,
  NotificationRow,
  NewNotificationRow,
  DeliveryRow,
  NewDeliveryRow,
  DeviceRow,
  NewDeviceRow,
  PreferenceRow,
  NewPreferenceRow,
  SuppressionRow,
  NewSuppressionRow,
} from './schema/schema'

export { runNotificationMigrations, notificationMigrationsFolder, NOTIFICATION_MIGRATIONS_TABLE } from './runMigrations'
export type { RunNotificationMigrationsParams } from './runMigrations'

export { encodeNotificationCursor, decodeNotificationCursor } from './repositories/cursor'
export type { NotificationCursor } from './repositories/cursor'

export { NotificationRepository } from './repositories/NotificationRepository'
export type { ListNotificationsQuery, ListNotificationsPage } from './repositories/NotificationRepository'

export { DeliveryRepository } from './repositories/DeliveryRepository'
export type { UpdateDeliveryAttemptParams } from './repositories/DeliveryRepository'

export { DeviceRepository } from './repositories/DeviceRepository'
export { PreferenceRepository } from './repositories/PreferenceRepository'
export type { PreferenceUpsertInput } from './repositories/PreferenceRepository'

export { TemplateRepository } from './repositories/TemplateRepository'
export type { UpsertTemplateInput } from './repositories/TemplateRepository'

export { SuppressionRepository } from './repositories/SuppressionRepository'
