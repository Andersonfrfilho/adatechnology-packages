/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { PUSH_DRIVER } from '@adatechnology/notification-contracts'
import type { PushDriverPort } from '@adatechnology/notification-contracts'

import { createExpoPushProvider, type ExpoPushProviderConfig } from './ExpoPushProvider'
import { createFcmPushProvider, type FcmPushProviderConfig } from './FcmPushProvider'

export type CreatePushProviderParams =
  | ({ readonly driver: typeof PUSH_DRIVER.EXPO } & ExpoPushProviderConfig)
  | ({ readonly driver: typeof PUSH_DRIVER.FCM } & FcmPushProviderConfig)

export function createPushProvider(params: CreatePushProviderParams): PushDriverPort {
  if (params.driver === PUSH_DRIVER.EXPO) return createExpoPushProvider(params)
  if (params.driver === PUSH_DRIVER.FCM) return createFcmPushProvider(params)

  const _exhaustive: never = params
  throw new Error(`Driver de push desconhecido: ${String((_exhaustive as { driver?: unknown }).driver)}`)
}
