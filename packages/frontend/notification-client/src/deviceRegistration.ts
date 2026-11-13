/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Registro de dispositivo para push. **Não importa `expo-notifications` nem `firebase`**: recebe
 * `getToken` por injeção. É o que mantém o pacote isomórfico — o cawme passa o token do Expo, o
 * PWA do quickcart passa o do FCM web, e nenhum dos dois carrega o SDK do outro.
 */

import type { DeviceRegistration } from '@adatechnology/notification-contracts'

import type { NotificationClient, RegisterDeviceInput } from './httpClient'

export type DeviceRegistrationConfig = {
  readonly client: NotificationClient
  readonly driver: 'expo' | 'fcm'
  /** `undefined` = permissão negada ou indisponível; o registro é pulado sem erro. */
  getToken(): Promise<string | undefined>
  /** Persiste o id entre execuções, para o logout conseguir remover o device certo. */
  readonly storage?: DeviceRegistrationStorage
}

/** `AsyncStorage` do RN e `localStorage` do web satisfazem esta forma (via wrapper trivial). */
export type DeviceRegistrationStorage = {
  getItem(key: string): Promise<string | null> | string | null
  setItem(key: string, value: string): Promise<void> | void
  removeItem(key: string): Promise<void> | void
}

export type RegisterOptions = {
  readonly platform: 'ios' | 'android' | 'web'
  readonly appVersion?: string
  readonly locale?: string
  readonly timezone?: string
}

export type DeviceRegistrationHandle = {
  /** Idempotente: chamar de novo com o mesmo token reativa o registro em vez de duplicar. */
  register(options: RegisterOptions): Promise<DeviceRegistration | undefined>
  /** No logout — sem isto, o aparelho continuaria recebendo push do usuário anterior. */
  unregister(): Promise<void>
}

const STORAGE_KEY = 'adatechnology:notification:device-id'

export function createDeviceRegistration(config: DeviceRegistrationConfig): DeviceRegistrationHandle {
  async function rememberDeviceId(deviceId: string): Promise<void> {
    await config.storage?.setItem(STORAGE_KEY, deviceId)
  }

  return {
    async register(options): Promise<DeviceRegistration | undefined> {
      const token = await config.getToken()
      // Permissão negada é o caminho normal, não erro: o usuário pode recusar push e o resto do
      // app continua funcionando (inbox e e-mail seguem).
      if (!token) return undefined

      const input: RegisterDeviceInput = {
        platform: options.platform,
        driver: config.driver,
        token,
        appVersion: options.appVersion,
        locale: options.locale,
        timezone: options.timezone,
      }

      const device = await config.client.registerDevice(input)
      await rememberDeviceId(device.id)
      return device
    },

    async unregister(): Promise<void> {
      const deviceId = await config.storage?.getItem(STORAGE_KEY)
      if (!deviceId) return

      await config.client.unregisterDevice(deviceId)
      await config.storage?.removeItem(STORAGE_KEY)
    },
  }
}
