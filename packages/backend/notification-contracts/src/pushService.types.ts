/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Contratos do Container de Serviço Push Notification dedicado (Railway).
 * Cobre Web Push nativo (VAPID RFC 8292 sem Firebase) e Mobile Push (Expo).
 */

import type { DeliveryAttemptResult } from './channelDrivers'
import type { CompanyId, DevicePlatform, PushDriver, UserId, WebPushSubscription } from './notification.types'

export type PushNotificationPayload = {
  readonly title: string
  readonly body: string
  readonly icon?: string
  readonly badge?: number
  readonly image?: string
  readonly tag?: string
  readonly url?: string
  readonly data?: Readonly<Record<string, unknown>>
}

export type SendPushDirectTarget =
  | { readonly type: 'token'; readonly token: string; readonly platform: DevicePlatform; readonly driver?: PushDriver }
  | { readonly type: 'user'; readonly userId: UserId }
  | { readonly type: 'subscription'; readonly subscription: WebPushSubscription }

export type SendPushDirectParams = {
  readonly companyId: CompanyId
  readonly target: SendPushDirectTarget
  readonly notification: PushNotificationPayload
  readonly dedupeKey?: string
}

export type SendPushDirectResult = {
  readonly success: boolean
  readonly messageId?: string
  readonly outcome: DeliveryAttemptResult
}

export type BroadcastPushFilter = {
  readonly topic?: string
  readonly tags?: readonly string[]
  readonly platform?: DevicePlatform
}

export type BroadcastPushParams = {
  readonly companyId: CompanyId
  readonly filter?: BroadcastPushFilter
  readonly notification: PushNotificationPayload
}

export type BroadcastPushResult = {
  readonly sentCount: number
  readonly failedCount: number
  readonly invalidTargetsRemoved: number
}

export type RegisterPushSubscriptionParams = {
  readonly companyId: CompanyId
  readonly userId?: UserId
  readonly platform: DevicePlatform
  readonly driver: PushDriver
  readonly subscription: WebPushSubscription
  readonly appVersion?: string
  readonly locale?: string
  readonly timezone?: string
  readonly tags?: readonly string[]
}

export type PushSubscriptionRecord = {
  readonly id: string
  readonly companyId: CompanyId
  readonly userId?: UserId
  readonly platform: DevicePlatform
  readonly driver: PushDriver
  readonly endpoint: string
  readonly lastSeenAt: string
}

export type VapidKeys = {
  readonly publicKey: string
  readonly privateKey: string
  /** Contato para RFC 8292: `mailto:admin@empresa.com` */
  readonly subject: string
}

export type PushServiceContainerConfig = {
  readonly port?: number
  readonly vapidKeys: VapidKeys
  readonly expoAccessToken?: string
  readonly defaultTtlSeconds?: number
  readonly allowedOrigins?: readonly string[]
}

export interface PushServicePort {
  getVapidPublicKey(): string
  send(params: SendPushDirectParams): Promise<SendPushDirectResult>
  broadcast(params: BroadcastPushParams): Promise<BroadcastPushResult>
  registerSubscription(params: RegisterPushSubscriptionParams): Promise<PushSubscriptionRecord>
  unregisterSubscription(companyId: CompanyId, endpointOrDeviceId: string): Promise<void>
}
