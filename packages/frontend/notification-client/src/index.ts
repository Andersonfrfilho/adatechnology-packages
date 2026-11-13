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

export {
  isWebPushSupported,
  urlBase64ToUint8Array,
  arrayBufferToBase64Url,
  subscribeWebPush,
  unsubscribeWebPush,
  getWebPushSubscription,
  getStandardWebPushServiceWorkerScript,
} from './webPush'
export type { SubscribeWebPushOptions } from './webPush'

export { getExpoPushToken, createExpoPushRegistration } from './expoPush'
export type {
  ExpoNotificationsModule,
  ExpoPermissionResponse,
  ExpoPushTokenResult,
  GetExpoPushTokenOptions,
  CreateExpoPushRegistrationConfig,
} from './expoPush'
