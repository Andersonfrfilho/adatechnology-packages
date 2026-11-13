/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import crypto from 'node:crypto'
import { ConfigMissingError, PUSH_DRIVER, type WebPushSubscription } from '@adatechnology/notification-contracts'

import {
  buildVapidJwt,
  createWebPushProvider,
  encryptPayloadRfc8291,
  generateVapidKeys,
  type FetchLike,
} from './WebPushProvider'

describe('WebPushProvider', () => {
  const vapidKeys = generateVapidKeys()
  const fullVapidConfig = {
    ...vapidKeys,
    subject: 'mailto:notifications@adatechnology.com.br',
  }

  // Gera uma subscription simulada de browser
  const clientEcdh = crypto.createECDH('prime256v1')
  clientEcdh.generateKeys()
  const mockSubscription: WebPushSubscription = {
    endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/mock-endpoint-id',
    keys: {
      p256dh: clientEcdh.getPublicKey().toString('base64url'),
      auth: crypto.randomBytes(16).toString('base64url'),
    },
  }

  it('generateVapidKeys produz chaves P-256 no formato base64url', () => {
    const keys = generateVapidKeys()
    expect(keys.publicKey).toBeDefined()
    expect(keys.privateKey).toBeDefined()
    // Chave pública não compactada (65 bytes = 87 chars base64url)
    expect(Buffer.from(keys.publicKey, 'base64url').length).toBe(65)
    // Chave privada (32 bytes = 43 chars base64url)
    expect(Buffer.from(keys.privateKey, 'base64url').length).toBe(32)
  })

  it('buildVapidJwt cria JWT ES256 válido com claims corretos', () => {
    const jwt = buildVapidJwt({
      audience: 'https://updates.push.services.mozilla.com',
      subject: fullVapidConfig.subject,
      publicKeyBase64Url: fullVapidConfig.publicKey,
      privateKeyBase64Url: fullVapidConfig.privateKey,
    })

    const parts = jwt.split('.')
    expect(parts.length).toBe(3)

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString()) as { alg: string; typ: string }
    expect(header.alg).toBe('ES256')
    expect(header.typ).toBe('JWT')

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as {
      aud: string
      sub: string
      exp: number
    }
    expect(payload.aud).toBe('https://updates.push.services.mozilla.com')
    expect(payload.sub).toBe(fullVapidConfig.subject)
  })

  it('encryptPayloadRfc8291 criptografa com formato aes128gcm', () => {
    const message = JSON.stringify({ title: 'Alerta', body: 'Mensagem de teste' })
    const encrypted = encryptPayloadRfc8291(message, mockSubscription)

    expect(encrypted.headers['Content-Encoding']).toBe('aes128gcm')
    expect(encrypted.headers['Content-Type']).toBe('application/octet-stream')
    expect(encrypted.body.length).toBeGreaterThan(message.length)
  })

  it('falha no boot sem vapidKeys declaradas', () => {
    expect(() => createWebPushProvider({})).toThrow(ConfigMissingError)
  })

  it('envia notificação com sucesso quando o endpoint responde 201 Created', async () => {
    let capturedHeaders: Record<string, string> = {}

    const customFetch: FetchLike = async (_input, init) => {
      capturedHeaders = init?.headers as Record<string, string>
      return new Response(null, {
        status: 201,
        headers: { location: 'https://updates.push.services.mozilla.com/message/12345' },
      })
    }

    const provider = createWebPushProvider({
      vapidKeys: fullVapidConfig,
      fetchImpl: customFetch,
    })

    expect(provider.driver).toBe(PUSH_DRIVER.WEBPUSH)

    const result = await provider.send({
      platform: 'web',
      token: JSON.stringify(mockSubscription),
      title: 'Pedido Pronto',
      body: 'Seu pedido #42 está pronto para retirada',
    })

    expect(result.outcome).toBe('sent')
    if (result.outcome === 'sent') {
      expect(result.providerMessageId).toBe('https://updates.push.services.mozilla.com/message/12345')
    }
    expect(capturedHeaders.Authorization).toContain('vapid t=')
    expect(capturedHeaders['Content-Encoding']).toBe('aes128gcm')
  })

  it('classifica status 410 / 404 como invalid_target para desativar o registro', async () => {
    const customFetch: FetchLike = async () => new Response('Gone', { status: 410 })

    const provider = createWebPushProvider({
      vapidKeys: fullVapidConfig,
      fetchImpl: customFetch,
    })

    const result = await provider.send({
      platform: 'web',
      token: JSON.stringify(mockSubscription),
      title: 'Teste',
      body: 'Corpo',
    })

    expect(result.outcome).toBe('invalid_target')
  })

  it('classifica status 429 como retriable com retryAfterSeconds respeitado', async () => {
    const customFetch: FetchLike = async () =>
      new Response('Rate Limited', {
        status: 429,
        headers: { 'retry-after': '30' },
      })

    const provider = createWebPushProvider({
      vapidKeys: fullVapidConfig,
      fetchImpl: customFetch,
    })

    const result = await provider.send({
      platform: 'web',
      token: JSON.stringify(mockSubscription),
      title: 'Teste',
      body: 'Corpo',
    })

    expect(result.outcome).toBe('retriable')
    if (result.outcome === 'retriable') {
      expect(result.retryAfterSeconds).toBe(30)
    }
  })

  it('classifica status 5xx do serviço de push como retriable', async () => {
    const customFetch: FetchLike = async () => new Response('Server Error', { status: 503 })

    const provider = createWebPushProvider({
      vapidKeys: fullVapidConfig,
      fetchImpl: customFetch,
    })

    const result = await provider.send({
      platform: 'web',
      token: JSON.stringify(mockSubscription),
      title: 'Teste',
      body: 'Corpo',
    })

    expect(result.outcome).toBe('retriable')
  })

  it('classifica falha de rede como retriable', async () => {
    const customFetch: FetchLike = async () => {
      throw new Error('Connection reset by peer')
    }

    const provider = createWebPushProvider({
      vapidKeys: fullVapidConfig,
      fetchImpl: customFetch,
    })

    const result = await provider.send({
      platform: 'web',
      token: JSON.stringify(mockSubscription),
      title: 'Teste',
      body: 'Corpo',
    })

    expect(result.outcome).toBe('retriable')
  })
})
