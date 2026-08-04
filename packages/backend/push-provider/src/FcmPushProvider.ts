/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { ConfigMissingError, DEVICE_PLATFORM, PUSH_DRIVER } from '@adatechnology/notification-contracts'
import type { DeliveryAttemptResult, PushDriverPort, SendPushParams } from '@adatechnology/notification-contracts'

import { isFcmError, type FcmMessage, type FcmMessagingClient } from './FcmMessagingClient'

export type FcmPushProviderConfig = {
  /** Conteúdo do JSON de credencial de serviço (nunca um caminho de arquivo — evita I/O no boot). */
  readonly serviceAccountJson?: string
  /** Nome do app do firebase-admin; só relevante se o processo hospeda mais de um. */
  readonly appName?: string
  /** Injeção de teste — presente, o `firebase-admin` real nunca é importado. */
  readonly messagingClient?: FcmMessagingClient
}

// admin.messaging(): FirebaseMessagingError.code documentado pelo SDK.
const INVALID_TARGET_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
])
const RETRIABLE_CODES = new Set([
  'messaging/message-rate-exceeded',
  'messaging/device-message-rate-exceeded',
  'messaging/quota-exceeded',
  'messaging/unavailable',
  'messaging/internal-error',
])

function classifyFcmError(error: unknown): DeliveryAttemptResult {
  if (!isFcmError(error)) return { outcome: 'retriable', errorCode: 'unknown' }
  if (INVALID_TARGET_CODES.has(error.code)) return { outcome: 'invalid_target', errorCode: error.code }
  if (RETRIABLE_CODES.has(error.code)) return { outcome: 'retriable', errorCode: error.code }
  return { outcome: 'permanent', errorCode: error.code }
}

/**
 * Web push usa o mesmo `messaging().send()` do FCM — só o bloco `webpush` muda. É o que permite
 * validar o canal push inteiro pelo PWA do quickcart, sem depender de um app mobile.
 */
function buildFcmMessage(params: SendPushParams): FcmMessage {
  const base = {
    token: params.token,
    notification: { title: params.title, body: params.body },
    data: params.data,
  }

  if (params.platform === DEVICE_PLATFORM.WEB) {
    return { ...base, webpush: { notification: { title: params.title, body: params.body } } }
  }
  if (params.platform === DEVICE_PLATFORM.IOS) {
    return { ...base, apns: { payload: { aps: { badge: params.badge } } } }
  }
  return params.badge === undefined ? base : { ...base, android: { notification: { notificationCount: params.badge } } }
}

// firebase-admin (~40 MB) só é importado quando o driver FCM é de fato usado sem cliente injetado
// — quem só usa Expo, ou quem testa com dublê, nunca carrega o SDK.
async function initFirebaseMessaging(config: FcmPushProviderConfig): Promise<FcmMessagingClient> {
  if (!config.serviceAccountJson) throw new ConfigMissingError('serviceAccountJson')

  const admin = await import('firebase-admin')
  const appName = config.appName ?? 'adatechnology-notification-push'
  const existingApp = admin.apps.find((app) => app?.name === appName)
  const app =
    existingApp ??
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(config.serviceAccountJson)) }, appName)

  return admin.messaging(app)
}

export function createFcmPushProvider(config: FcmPushProviderConfig = {}): PushDriverPort {
  let clientPromise: Promise<FcmMessagingClient> | undefined

  function resolveClient(): Promise<FcmMessagingClient> {
    if (config.messagingClient) return Promise.resolve(config.messagingClient)
    clientPromise ??= initFirebaseMessaging(config)
    return clientPromise
  }

  return {
    driver: PUSH_DRIVER.FCM,
    async send(params: SendPushParams): Promise<DeliveryAttemptResult> {
      const client = await resolveClient()
      try {
        const providerMessageId = await client.send(buildFcmMessage(params))
        return { outcome: 'sent', providerMessageId }
      } catch (error) {
        return classifyFcmError(error)
      }
    },
  }
}
