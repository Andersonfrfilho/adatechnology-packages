/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Superfície principal do módulo. Os adaptadores opcionais vivem em entrypoints próprios
 * (`./http/fetch`, `./http/uws`, `./queue/bullmq`, `./queue/amqp`, `./openapi`, `./testing`) —
 * quem não importa, não carrega a dependência.
 */

export { createNotificationRoutes } from './http/routes'
export type { CreateNotificationRoutesParams } from './http/routes'
export { DEFAULT_SSE_HEARTBEAT_SECONDS } from './http/inboxRoutes'
export { compileRoutes, dispatchRoute, findRoute } from './http/dispatchRoute'
export type { CompiledRoute, RawRequest, DispatchRouteParams } from './http/dispatchRoute'
export { toErrorResult, toValidationResult, VALIDATION_ERROR_CODE, INTERNAL_ERROR_CODE } from './http/errorFilter'
export { compilePath, matchPath } from './http/pathMatcher'
export type { CompiledPath } from './http/pathMatcher'

export { createNotificationWorker, createNotificationSchedules } from './worker'
export type { NotificationWorker, CreateNotificationWorkerParams, NotificationSchedule } from './worker'

export { createInProcessRealtimeNotifier } from './shared/InProcessRealtimeNotifier'

export { createNotificationModule } from './NotificationModule'
export type {
  NotificationModule,
  NotificationModuleConfig,
  NotificationModuleFeatures,
  NotificationModuleProviders,
  CreateNotificationModuleParams,
} from './NotificationModule'

export { SendNotificationUseCase } from './use-cases/SendNotification.use-case'
export type { SendNotificationDependencies, SendNotificationConfig } from './use-cases/SendNotification.use-case'
export { DispatchDeliveryUseCase } from './use-cases/DispatchDelivery.use-case'
export type { DispatchDeliveryDependencies, DispatchDeliveryConfig } from './use-cases/dispatchDelivery.types'
export { DispatchDueNotificationsUseCase } from './use-cases/DispatchDueNotifications.use-case'
export { ReceiveDeliveryReceiptUseCase } from './use-cases/ReceiveDeliveryReceipt.use-case'
export { PurgeExpiredNotificationsUseCase } from './use-cases/PurgeExpiredNotifications.use-case'
export {
  ListNotificationsUseCase,
  CountUnreadUseCase,
  MarkAsReadUseCase,
  MarkAllAsReadUseCase,
  DeleteNotificationUseCase,
} from './use-cases/Inbox.use-cases'
export {
  RegisterDeviceUseCase,
  UnregisterDeviceUseCase,
  GetPreferencesUseCase,
  UpdatePreferencesUseCase,
} from './use-cases/DeviceAndPreference.use-cases'
export type { RegisterDeviceParams } from './use-cases/DeviceAndPreference.use-cases'
export {
  UpsertTemplateUseCase,
  ListTemplatesUseCase,
  SeedDefaultTemplatesUseCase,
} from './use-cases/Template.use-cases'

export { createDefaultTemplateRenderer, renderDefaultTemplate } from './shared/DefaultTemplateRenderer'
export { createInProcessQueue } from './shared/InProcessQueue'
export { planDeliveries } from './shared/planDeliveries'
export type { PlannedChannel, PlannedChannelAction, QuietHoursWindow } from './shared/planDeliveries'
export { currentHHmmInTimezone, isWithinQuietHours, nextAllowedInstant } from './shared/quietHours'
export { resolveRecipientTimezone } from './shared/resolveRecipientTimezone'
export { hashTarget, maskTarget } from './shared/targetPrivacy'
export { computeNotificationStatus } from './shared/notificationAggregateStatus'
export {
  verifyNotificationWebhookSignature,
  claimNotificationWebhookDelivery,
  WEBHOOK_TIMESTAMP_WINDOW_SECONDS,
  WEBHOOK_NONCE_TTL_SECONDS,
} from './shared/webhookSecurity'

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
