/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createPushProvider } from './PushProviderFactory'

describe('createPushProvider', () => {
  it('cria o driver Expo', () => {
    const provider = createPushProvider({ driver: 'expo' })
    expect(provider.driver).toBe('expo')
  })

  it('cria o driver FCM', () => {
    const provider = createPushProvider({ driver: 'fcm', messagingClient: { send: async () => 'id' } })
    expect(provider.driver).toBe('fcm')
  })

  it('rejeita driver desconhecido em runtime, mesmo escapando o tipo', () => {
    const params = { driver: 'onesignal' } as unknown as Parameters<typeof createPushProvider>[0]
    expect(() => createPushProvider(params)).toThrow(/desconhecido/)
  })
})
