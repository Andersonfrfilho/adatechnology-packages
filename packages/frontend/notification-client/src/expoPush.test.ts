/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { getExpoPushToken, type ExpoNotificationsModule } from './expoPush'

describe('expoPush helper', () => {
  it('solicita permissão quando não estiver concedida inicialmente', async () => {
    let requested = false
    const mockModule: ExpoNotificationsModule = {
      getPermissionsAsync: async () => ({ status: 'undetermined', granted: false }),
      requestPermissionsAsync: async () => {
        requested = true
        return { status: 'granted', granted: true }
      },
      getExpoPushTokenAsync: async () => ({ data: 'ExponentPushToken[mock-token-123]' }),
    }

    const token = await getExpoPushToken({ module: mockModule })
    expect(requested).toBe(true)
    expect(token).toBe('ExponentPushToken[mock-token-123]')
  })

  it('retorna undefined sem erro quando o usuário recusa a permissão', async () => {
    const mockModule: ExpoNotificationsModule = {
      getPermissionsAsync: async () => ({ status: 'denied', granted: false }),
      requestPermissionsAsync: async () => ({ status: 'denied', granted: false }),
      getExpoPushTokenAsync: async () => ({ data: 'ExponentPushToken[mock-token-123]' }),
    }

    const token = await getExpoPushToken({ module: mockModule })
    expect(token).toBeUndefined()
  })

  it('configura o canal de notificação no Android quando a função existe', async () => {
    let configuredChannel: string | undefined
    const mockModule: ExpoNotificationsModule = {
      getPermissionsAsync: async () => ({ status: 'granted', granted: true }),
      requestPermissionsAsync: async () => ({ status: 'granted', granted: true }),
      getExpoPushTokenAsync: async () => ({ data: 'ExponentPushToken[mock-token-123]' }),
      setNotificationChannelAsync: async (channelId) => {
        configuredChannel = channelId
      },
    }

    const token = await getExpoPushToken({
      module: mockModule,
      channelId: 'pedidos',
      channelName: 'Atualizações de Pedidos',
    })
    expect(token).toBe('ExponentPushToken[mock-token-123]')
    expect(configuredChannel).toBe('pedidos')
  })
})
