/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export {
  NOTIFICATION_CHANNEL,
  INTRUSIVE_CHANNELS,
  NOTIFICATION_STATUS,
  DELIVERY_STATUS,
  DEVICE_PLATFORM,
  PUSH_DRIVER,
  EMAIL_DRIVER,
  SUPPRESSION_REASON,
  NOTIFICATION_CATEGORY_HINT,
} from './notification.types'
export type {
  NotificationChannel,
  NotificationStatus,
  DeliveryStatus,
  DevicePlatform,
  PushDriver,
  EmailDriver,
  SuppressionReason,
  NotificationId,
  CompanyId,
  UserId,
  NotificationSummary,
  DeliverySummary,
  DeviceRegistration,
  NotificationPreference,
  NotificationTemplate,
  SendNotificationParams,
  SendNotificationResult,
  ListNotificationsParams,
  ListNotificationsResult,
  DeliveryReceipt,
} from './notification.types'

export type {
  DeliveryAttemptResult,
  SendPushParams,
  SendEmailParams,
  SendWhatsAppParams,
  SendWhatsAppTemplateParams,
  SendSmsParams,
  PushDriverPort,
  EmailDriverPort,
  WhatsAppDriverPort,
  SmsDriverPort,
  ChannelDrivers,
} from './channelDrivers'

export type {
  ResolvedRecipient,
  RecipientResolverPort,
  NotificationJob,
  QueuePort,
  RenderTemplateParams,
  RenderedTemplate,
  TemplateRendererPort,
  CachePort,
  RealtimeNotifierPort,
  RealtimeEvent,
  RealtimeSubscription,
  ClockPort,
  LogMeta,
  LoggerPort,
  MetricsPort,
} from './providers'

export {
  sendNotificationSchema,
  registerDeviceSchema,
  preferenceEntrySchema,
  updatePreferencesSchema,
  upsertTemplateSchema,
  listNotificationsQuerySchema,
  deliveryWebhookSchema,
} from './schemas'
export type {
  SendNotificationBody,
  RegisterDeviceBody,
  UpdatePreferencesBody,
  UpsertTemplateBody,
  ListNotificationsQuery,
  DeliveryWebhookBody,
} from './schemas'

export { NOTIFICATION_EVENT } from './events'
export type {
  NotificationEvent,
  NotificationCreatedEvent,
  NotificationDispatchedEvent,
  NotificationReadEvent,
  DeliverySentEvent,
  DeliveryFailedEvent,
  DeliveryBouncedEvent,
  DeviceRegisteredEvent,
  DeviceInvalidatedEvent,
  PreferencesUpdatedEvent,
  NotificationHooks,
} from './events'

export {
  NotificationError,
  NOTIFICATION_ERROR_CODES,
  TemplateNotFoundError,
  ChannelNotConfiguredError,
  RecipientUnresolvedError,
  SuppressedTargetError,
  NotificationNotFoundError,
  InvalidWebhookSignatureError,
  DuplicateWebhookDeliveryError,
  DeviceNotFoundError,
  ThrottledError,
  ConfigMissingError,
} from './errors'

export { createWhatsAppDriverFromChannel } from './whatsappDriver'
export type { WhatsAppSendingChannel } from './whatsappDriver'

export {
  deriveTitleFromBody,
  escapeTemplateHtml,
  extractTemplatePlaceholders,
  interpolateTemplate,
  renderTemplate,
} from './templateRender'
export type { RenderedTemplatePreview } from './templateRender'
