/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Driver de Web Push nativo (W3C Push API / RFC 8030, RFC 8291, RFC 8292).
 * Não depende de Firebase nem do Google Cloud: autentica via chaves VAPID próprias
 * e despacha diretamente para os endpoints dos navegadores (Mozilla, Apple, Google).
 */

import crypto from 'node:crypto'
import {
  ConfigMissingError,
  PUSH_DRIVER,
  type DeliveryAttemptResult,
  type PushDriverPort,
  type SendPushParams,
  type VapidKeys,
  type WebPushSubscription,
} from '@adatechnology/notification-contracts'

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export type WebPushProviderConfig = {
  readonly vapidKeys?: VapidKeys
  readonly fetchImpl?: FetchLike
  readonly defaultTtlSeconds?: number
}

export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const ecdh = crypto.createECDH('prime256v1')
  ecdh.generateKeys()
  const publicKey = ecdh.getPublicKey().toString('base64url')
  const privateKey = ecdh.getPrivateKey().toString('base64url')
  return { publicKey, privateKey }
}

function parseWebPushSubscription(params: SendPushParams): WebPushSubscription | undefined {
  if (params.subscription) return params.subscription
  try {
    const parsed = JSON.parse(params.token) as Record<string, unknown>
    if (typeof parsed?.endpoint === 'string' && typeof parsed?.keys === 'object' && parsed.keys !== null) {
      const keys = parsed.keys as Record<string, unknown>
      if (typeof keys.p256dh === 'string' && typeof keys.auth === 'string') {
        return {
          endpoint: parsed.endpoint,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
        }
      }
    }
  } catch {
    // Não é JSON serializado; token pode ser a URL de endpoint pura
    if (params.token.startsWith('http://') || params.token.startsWith('https://')) {
      return undefined // endpoint sem keys não pode ser criptografado
    }
  }
  return undefined
}

export function buildVapidJwt(params: {
  audience: string
  subject: string
  privateKeyBase64Url: string
  publicKeyBase64Url: string
  expirationSeconds?: number
}): string {
  const header = { alg: 'ES256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const exp = now + (params.expirationSeconds ?? 12 * 3600)
  const payload = { aud: params.audience, exp, sub: params.subject }

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const unsignedToken = `${encodedHeader}.${encodedPayload}`

  const pubKeyBytes = Buffer.from(params.publicKeyBase64Url, 'base64url')
  const privKeyBytes = Buffer.from(params.privateKeyBase64Url, 'base64url')

  const keyObject = crypto.createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: pubKeyBytes.subarray(1, 33).toString('base64url'),
      y: pubKeyBytes.subarray(33, 65).toString('base64url'),
      d: privKeyBytes.toString('base64url'),
    },
    format: 'jwk',
  })

  const signer = crypto.createSign('SHA256')
  signer.update(unsignedToken)
  const signature = signer.sign({ key: keyObject, dsaEncoding: 'ieee-p1363' }).toString('base64url')

  return `${unsignedToken}.${signature}`
}

export function encryptPayloadRfc8291(
  payloadText: string,
  subscription: WebPushSubscription,
): { body: Uint8Array; headers: Record<string, string> } {
  const clientPub = Buffer.from(subscription.keys.p256dh, 'base64url')
  const clientAuth = Buffer.from(subscription.keys.auth, 'base64url')

  const serverEcdh = crypto.createECDH('prime256v1')
  serverEcdh.generateKeys()
  const serverPub = serverEcdh.getPublicKey()

  const sharedSecret = serverEcdh.computeSecret(clientPub)

  const authInfo = Buffer.concat([Buffer.from('WebPush: info\0'), clientPub, serverPub])
  const ikm = crypto.hkdfSync('sha256', sharedSecret, clientAuth, authInfo, 32)

  const salt = crypto.randomBytes(16)
  const cekInfo = Buffer.from('Content-Encoding: aes128gcm\0')
  const cek = crypto.hkdfSync('sha256', Buffer.from(ikm), salt, cekInfo, 16)

  const nonceInfo = Buffer.from('Content-Encoding: nonce\0')
  const nonce = crypto.hkdfSync('sha256', Buffer.from(ikm), salt, nonceInfo, 12)

  const cipher = crypto.createCipheriv('aes-128-gcm', Buffer.from(cek), Buffer.from(nonce))
  const plaintext = Buffer.concat([Buffer.from(payloadText, 'utf-8'), Buffer.from([2])])
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()])

  // Cabeçalho RFC 8188 (salt: 16b, rs: 4b big-endian, idlen: 1b, key: 65b)
  const recordHeader = Buffer.concat([salt, Buffer.from([0, 0, 16, 0]), Buffer.from([serverPub.length]), serverPub])

  const fullBody = Buffer.concat([recordHeader, encrypted])

  return {
    body: fullBody,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
    },
  }
}

export function createWebPushProvider(config: WebPushProviderConfig = {}): PushDriverPort {
  if (!config.vapidKeys) {
    throw new ConfigMissingError('vapidKeys')
  }

  const { vapidKeys } = config
  const fetchImpl = config.fetchImpl ?? fetch
  const defaultTtl = config.defaultTtlSeconds ?? 86400

  return {
    driver: PUSH_DRIVER.WEBPUSH,
    async send(params: SendPushParams): Promise<DeliveryAttemptResult> {
      const subscription = parseWebPushSubscription(params)
      if (!subscription) {
        return {
          outcome: 'permanent',
          errorCode: 'webpush_subscription_invalid_or_missing_keys',
        }
      }

      let audience: string
      try {
        const url = new URL(subscription.endpoint)
        audience = `${url.protocol}//${url.host}`
      } catch {
        return { outcome: 'invalid_target', errorCode: 'invalid_endpoint_url' }
      }

      const jwt = buildVapidJwt({
        audience,
        subject: vapidKeys.subject,
        publicKeyBase64Url: vapidKeys.publicKey,
        privateKeyBase64Url: vapidKeys.privateKey,
      })

      const payload = JSON.stringify({
        title: params.title,
        body: params.body,
        badge: params.badge,
        data: params.data,
      })

      const encrypted = encryptPayloadRfc8291(payload, subscription)

      try {
        const response = await fetchImpl(subscription.endpoint, {
          method: 'POST',
          headers: {
            ...encrypted.headers,
            TTL: String(defaultTtl),
            Authorization: `vapid t=${jwt}, k=${vapidKeys.publicKey}`,
          },
          body: Buffer.from(encrypted.body),
        })

        if (response.status === 201 || response.status === 200 || response.status === 204) {
          const location = response.headers.get('location') ?? undefined
          return { outcome: 'sent', providerMessageId: location }
        }

        if (response.status === 404 || response.status === 410) {
          return { outcome: 'invalid_target', errorCode: `webpush_${response.status}_gone` }
        }

        if (response.status === 429) {
          const retryHeader = response.headers.get('retry-after')
          const retryAfterSeconds = retryHeader ? parseInt(retryHeader, 10) || 60 : 60
          return { outcome: 'retriable', errorCode: 'webpush_rate_limit', retryAfterSeconds }
        }

        if (response.status >= 500) {
          return { outcome: 'retriable', errorCode: `webpush_server_${response.status}` }
        }

        return { outcome: 'permanent', errorCode: `webpush_status_${response.status}` }
      } catch (err) {
        return {
          outcome: 'retriable',
          errorCode: err instanceof Error ? err.message : 'webpush_network_error',
        }
      }
    },
  }
}
