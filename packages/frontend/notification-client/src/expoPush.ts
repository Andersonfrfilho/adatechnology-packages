/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Helper de push para React Native com Expo.
 * **Não importa `expo-notifications` estaticamente**: recebe o módulo por injeção
 * (duck-typing) para não poluir nem quebrar o bundle web/PWA.
 */

import {
  createDeviceRegistration,
  type DeviceRegistrationHandle,
  type DeviceRegistrationStorage,
} from './deviceRegistration'
import type { NotificationClient } from './httpClient'

export type ExpoPermissionResponse = {
  readonly status: string
  readonly granted: boolean
}

export type ExpoPushTokenResult = {
  readonly data: string
}

export interface ExpoNotificationsModule {
  getPermissionsAsync(): Promise<ExpoPermissionResponse>
  requestPermissionsAsync(): Promise<ExpoPermissionResponse>
  getExpoPushTokenAsync(options?: { projectId?: string }): Promise<ExpoPushTokenResult>
  setNotificationChannelAsync?(
    channelId: string,
    channel: {
      name: string
      importance: number
      sound?: boolean
      vibrationPattern?: number[]
    },
  ): Promise<unknown>
}

export type GetExpoPushTokenOptions = {
  readonly module: ExpoNotificationsModule
  readonly projectId?: string
  readonly channelId?: string
  readonly channelName?: string
}

/**
 * Solicita permissões e obtém o Expo Push Token.
 * Se a permissão for negada, devolve `undefined` (caminho normal, sem erro).
 */
export async function getExpoPushToken(options: GetExpoPushTokenOptions): Promise<string | undefined> {
  const { module } = options

  const currentPerms = await module.getPermissionsAsync()
  let isGranted = currentPerms.granted

  if (!isGranted) {
    const requested = await module.requestPermissionsAsync()
    isGranted = requested.granted
  }

  if (!isGranted) return undefined

  if (typeof module.setNotificationChannelAsync === 'function') {
    await module.setNotificationChannelAsync(options.channelId ?? 'default', {
      name: options.channelName ?? 'Geral',
      importance: 4, // Android IMPORTANCE_HIGH
      sound: true,
    })
  }

  const tokenResult = await module.getExpoPushTokenAsync({
    projectId: options.projectId,
  })

  return tokenResult.data
}

export type CreateExpoPushRegistrationConfig = {
  readonly client: NotificationClient
  readonly module: ExpoNotificationsModule
  readonly projectId?: string
  readonly storage?: DeviceRegistrationStorage
}

/**
 * Cria o ciclo de vida completo de registro do dispositivo Expo integrado ao NotificationClient.
 */
export function createExpoPushRegistration(config: CreateExpoPushRegistrationConfig): DeviceRegistrationHandle {
  return createDeviceRegistration({
    client: config.client,
    driver: 'expo',
    storage: config.storage,
    getToken: () => getExpoPushToken({ module: config.module, projectId: config.projectId }),
  })
}
