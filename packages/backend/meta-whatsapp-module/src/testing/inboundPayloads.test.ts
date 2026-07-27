/**
 * Cobertura da assinatura de preview. As asserções usam a verificação real (`verifyWebhookSignature`)
 * e o anti-replay real (`claimWebhookDelivery`), não cópias adaptadas: se o payload de preview não
 * enfrenta o mesmo portão que a Meta enfrenta, o preview testa um caminho que não existe.
 *
 * O shape dos payloads é coberto em `meta-whatsapp-contracts`, onde os builders moram.
 */

import { describe, expect, it } from 'bun:test'
import { InvalidWebhookSignatureError } from '@adatechnology/meta-whatsapp-contracts'
import { buildInboundTextPayload } from '@adatechnology/meta-whatsapp-contracts/testing'
import { claimWebhookDelivery, verifyWebhookSignature, type NonceStoreInterface } from '../channel/webhookSecurity'
import { toSignedWebhookRequest } from './inboundPayloads'

const APP_SECRET = 'dev-app-secret'
const FROM = '5511988887777'

function createNonceStore(): NonceStoreInterface {
  const keys = new Set<string>()
  return {
    async setIfAbsent(key: string): Promise<boolean> {
      if (keys.has(key)) return false
      keys.add(key)
      return true
    },
  }
}

describe('assinatura do payload de preview', () => {
  it('passa pela verificação real de HMAC', () => {
    const payload = buildInboundTextPayload({ from: FROM, text: 'oi' })
    const request = toSignedWebhookRequest({ payload, appSecret: APP_SECRET })

    expect(() =>
      verifyWebhookSignature({
        rawBody: request.rawBody,
        signatureHeader: request.headers['x-hub-signature-256'],
        appSecret: APP_SECRET,
      }),
    ).not.toThrow()
  })

  // O preview não pode virar porta lateral: com segredo errado ou sem header, a recusa é a mesma
  // que em produção. Não existe modo de desenvolvimento que afrouxe isto.
  it('é recusado com segredo errado', () => {
    const payload = buildInboundTextPayload({ from: FROM, text: 'oi' })
    const request = toSignedWebhookRequest({ payload, appSecret: 'outro-segredo' })

    expect(() =>
      verifyWebhookSignature({
        rawBody: request.rawBody,
        signatureHeader: request.headers['x-hub-signature-256'],
        appSecret: APP_SECRET,
      }),
    ).toThrow(InvalidWebhookSignatureError)
  })

  it('é recusado sem header de assinatura', () => {
    const payload = buildInboundTextPayload({ from: FROM, text: 'oi' })
    const request = toSignedWebhookRequest({ payload, appSecret: APP_SECRET })

    expect(() =>
      verifyWebhookSignature({ rawBody: request.rawBody, signatureHeader: undefined, appSecret: APP_SECRET }),
    ).toThrow(InvalidWebhookSignatureError)
  })

  // Documenta por que `toSignedWebhookRequest` devolve o corpo serializado.
  it('quebra se o corpo for reserializado antes do envio', () => {
    const payload = buildInboundTextPayload({ from: FROM, text: 'oi' })
    const request = toSignedWebhookRequest({ payload, appSecret: APP_SECRET })
    // Mesmo conteúdo, bytes diferentes: basta o espaçamento mudar (um log que reindenta, um
    // cliente HTTP que reserializa o objeto) para a assinatura deixar de valer.
    const reserialized = JSON.stringify(JSON.parse(request.rawBody), null, 2)

    expect(() =>
      verifyWebhookSignature({
        rawBody: reserialized,
        signatureHeader: request.headers['x-hub-signature-256'],
        appSecret: APP_SECRET,
      }),
    ).toThrow(InvalidWebhookSignatureError)
  })
})

describe('anti-replay com mensagens repetidas', () => {
  // A regressão que este teste tranca: com `id`/`timestamp` fixos, duas mensagens de mesmo texto
  // gerariam a mesma assinatura e a segunda seria descartada como duplicata — o preview
  // "engoliria" o segundo "sim" da conversa sem erro nenhum.
  it('gera assinaturas distintas para texto idêntico e processa as duas entregas', async () => {
    const nonceStore = createNonceStore()

    const first = toSignedWebhookRequest({
      payload: buildInboundTextPayload({ from: FROM, text: 'sim' }),
      appSecret: APP_SECRET,
    })
    const second = toSignedWebhookRequest({
      payload: buildInboundTextPayload({ from: FROM, text: 'sim' }),
      appSecret: APP_SECRET,
    })

    const firstSignature = first.headers['x-hub-signature-256'] ?? ''
    const secondSignature = second.headers['x-hub-signature-256'] ?? ''

    expect(firstSignature).not.toBe(secondSignature)
    expect(await claimWebhookDelivery({ nonceStore, signatureHeader: firstSignature })).toBe(true)
    expect(await claimWebhookDelivery({ nonceStore, signatureHeader: secondSignature })).toBe(true)
  })

  it('descarta a mesma entrega reenviada', async () => {
    const nonceStore = createNonceStore()
    const request = toSignedWebhookRequest({
      payload: buildInboundTextPayload({ from: FROM, text: 'sim' }),
      appSecret: APP_SECRET,
    })
    const signatureHeader = request.headers['x-hub-signature-256'] ?? ''

    expect(await claimWebhookDelivery({ nonceStore, signatureHeader })).toBe(true)
    expect(await claimWebhookDelivery({ nonceStore, signatureHeader })).toBe(false)
  })
})
