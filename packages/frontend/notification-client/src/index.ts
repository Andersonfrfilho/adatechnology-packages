/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export { createNotificationClient } from './httpClient'
export type {
  NotificationClient,
  NotificationClientConfig,
  ListNotificationsOptions,
  ListNotificationsPage,
  RegisterDeviceInput,
  NotificationApiError,
} from './httpClient'

export { createDeviceRegistration } from './deviceRegistration'
export type {
  DeviceRegistrationConfig,
  DeviceRegistrationHandle,
  DeviceRegistrationStorage,
  RegisterOptions,
} from './deviceRegistration'

export { subscribeToNotificationStream } from './streamSubscription'
export type {
  NotificationStreamEvent,
  NotificationStreamSubscription,
  SubscribeToNotificationStreamParams,
} from './streamSubscription'
