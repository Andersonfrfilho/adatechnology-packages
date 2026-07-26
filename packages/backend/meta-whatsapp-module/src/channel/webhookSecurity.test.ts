/**
 * Cobertura da segurança do webhook. Estas asserções vieram do QuickCart, que mantinha os
 * próprios testes de assinatura antes de a verificação migrar para cá — o código mudou de casa,
 * a cobertura precisava mudar junto, ainda mais tratando-se do que separa uma entrega da Meta
 * de uma chamada forjada.
 */

import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'bun:test'
import { InvalidWebhookSignatureError } from '@adatechnology/meta-whatsapp-contracts'
import {
  claimWebhookDelivery,
  verifyWebhookChallenge,
  verifyWebhookSignature,
  WEBHOOK_NONCE_TTL_SECONDS,
  type NonceStoreInterface,
} from './webhookSecurity'

const APP_SECRET = 'segredo-do-app'

function sign(body: string, secret = APP_SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
}

// Store em memória, só para o teste — em produção precisa ser compartilhado entre instâncias.
function createNonceStore(): NonceStoreInterface & { readonly keys: Set<string> } {
  const keys = new Set<string>()
  return {
    keys,
    async setIfAbsent(key: string): Promise<boolean> {
      if (keys.has(key)) return false
      keys.add(key)
      return true
    },
  }
}

describe('verifyWebhookChallenge', () => {
  const expectedToken = 'token-de-verificacao'

  it('devolve o challenge quando modo e token conferem', () => {
    const challenge = verifyWebhookChallenge({
      mode: 'subscribe',
      token: expectedToken,
      challenge: 'desafio-123',
      expectedToken,
    })
    expect(challenge).toBe('desafio-123')
  })

  it('recusa token errado', () => {
    expect(() => verifyWebhookChallenge({ mode: 'subscribe', token: 'errado', challenge: 'x', expectedToken })).toThrow(
      InvalidWebhookSignatureError,
    )
  })

  it('recusa modo diferente de subscribe', () => {
    expect(() =>
      verifyWebhookChallenge({ mode: 'unsubscribe', token: expectedToken, challenge: 'x', expectedToken }),
    ).toThrow(InvalidWebhookSignatureError)
  })

  it('recusa quando falta token ou challenge', () => {
    expect(() => verifyWebhookChallenge({ mode: 'subscribe', token: null, challenge: 'x', expectedToken })).toThrow(
      InvalidWebhookSignatureError,
    )
    expect(() =>
      verifyWebhookChallenge({ mode: 'subscribe', token: expectedToken, challenge: null, expectedToken }),
    ).toThrow(InvalidWebhookSignatureError)
  })

  // Um token vazio dos dois lados não pode virar "confere" — seria aceitar qualquer chamada
  // num ambiente que esqueceu de configurar o segredo.
  it('não aceita challenge com token esperado vazio', () => {
    expect(() => verifyWebhookChallenge({ mode: 'subscribe', token: '', challenge: 'x', expectedToken: '' })).toThrow(
      InvalidWebhookSignatureError,
    )
  })
})

describe('verifyWebhookSignature', () => {
  const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })

  it('aceita corpo com assinatura correta', () => {
    expect(() =>
      verifyWebhookSignature({ rawBody: body, signatureHeader: sign(body), appSecret: APP_SECRET }),
    ).not.toThrow()
  })

  it('aceita Buffer tanto quanto string', () => {
    expect(() =>
      verifyWebhookSignature({
        rawBody: Buffer.from(body, 'utf8'),
        signatureHeader: sign(body),
        appSecret: APP_SECRET,
      }),
    ).not.toThrow()
  })

  it('recusa assinatura de outro segredo', () => {
    expect(() =>
      verifyWebhookSignature({
        rawBody: body,
        signatureHeader: sign(body, 'outro-segredo'),
        appSecret: APP_SECRET,
      }),
    ).toThrow(InvalidWebhookSignatureError)
  })

  // O ponto do HMAC: um byte alterado no corpo invalida a entrega.
  it('recusa corpo adulterado', () => {
    const signature = sign(body)
    const tampered = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: 'injetado' }] })
    expect(() =>
      verifyWebhookSignature({ rawBody: tampered, signatureHeader: signature, appSecret: APP_SECRET }),
    ).toThrow(InvalidWebhookSignatureError)
  })

  it('recusa header ausente ou sem o prefixo sha256=', () => {
    for (const header of [null, undefined, '', 'abc123', 'sha1=abc123']) {
      expect(() => verifyWebhookSignature({ rawBody: body, signatureHeader: header, appSecret: APP_SECRET })).toThrow(
        InvalidWebhookSignatureError,
      )
    }
  })
})

describe('claimWebhookDelivery', () => {
  const signatureHeader = sign('qualquer-corpo')

  it('concede a primeira entrega e nega a repetida', async () => {
    const nonceStore = createNonceStore()

    expect(await claimWebhookDelivery({ nonceStore, signatureHeader })).toBe(true)
    expect(await claimWebhookDelivery({ nonceStore, signatureHeader })).toBe(false)
  })

  it('trata entregas distintas de forma independente', async () => {
    const nonceStore = createNonceStore()

    expect(await claimWebhookDelivery({ nonceStore, signatureHeader })).toBe(true)
    expect(await claimWebhookDelivery({ nonceStore, signatureHeader: sign('outro-corpo') })).toBe(true)
  })

  it('usa chave namespaced para não colidir com outras chaves do cache do host', async () => {
    const nonceStore = createNonceStore()
    await claimWebhookDelivery({ nonceStore, signatureHeader })

    const [key] = [...nonceStore.keys]
    expect(key).toStartWith('meta-whatsapp:webhook:')
  })

  it('expõe um TTL positivo para a janela anti-replay', () => {
    expect(WEBHOOK_NONCE_TTL_SECONDS).toBeGreaterThan(0)
  })
})
