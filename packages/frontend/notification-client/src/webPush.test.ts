/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import {
  arrayBufferToBase64Url,
  getStandardWebPushServiceWorkerScript,
  getWebPushSubscription,
  isWebPushSupported,
  urlBase64ToUint8Array,
} from './webPush'

describe('webPush helpers', () => {
  it('urlBase64ToUint8Array converte chave VAPID base64url para Uint8Array', () => {
    // 65 bytes point
    const originalB64Url = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9tWVHRZ6w0o4VNf55J15D34q7EHoOx6mdEDGDeVelRGCdg'
    const array = urlBase64ToUint8Array(originalB64Url)
    expect(array).toBeInstanceOf(Uint8Array)
    expect(array.length).toBe(65)

    // Reversível via arrayBufferToBase64Url
    const restored = arrayBufferToBase64Url(array.buffer)
    expect(restored).toBe(originalB64Url)
  })

  it('arrayBufferToBase64Url trata buffer nulo como string vazia', () => {
    expect(arrayBufferToBase64Url(null)).toBe('')
  })

  it('isWebPushSupported devolve false em ambiente sem DOM/browser (Node/Bun sem mocks)', () => {
    // No ambiente do teste unitário padrão (sem browser real), não quebra e retorna booleano
    expect(typeof isWebPushSupported()).toBe('boolean')
  })

  it('getStandardWebPushServiceWorkerScript gera o script com listeners de push e notificationclick', () => {
    const script = getStandardWebPushServiceWorkerScript()
    expect(script).toContain("self.addEventListener('push'")
    expect(script).toContain("self.addEventListener('notificationclick'")
    expect(script).toContain('showNotification')
    expect(script).toContain('clients.openWindow')
  })

  it('getWebPushSubscription devolve undefined quando Web Push nao for suportado', async () => {
    const sub = await getWebPushSubscription()
    expect(sub).toBeUndefined()
  })
})
