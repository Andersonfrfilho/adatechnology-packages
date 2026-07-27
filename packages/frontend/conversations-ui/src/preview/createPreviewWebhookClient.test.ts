/**
 * O risco aqui não é o cliente montar o payload errado — é o HMAC do WebCrypto divergir do que o
 * servidor calcula com `node:crypto`. Uma divergência de um byte transforma todo envio do preview
 * em 401, então o teste compara as duas implementações diretamente.
 */

import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'bun:test'
import {
  assertPreviewEnvironment,
  createPreviewWebhookClient,
  PreviewInProductionError,
  PreviewWebhookRejectedError,
} from './createPreviewWebhookClient'

const APP_SECRET = 'dev-app-secret'
const FROM = '5511988887777'
const WEBHOOK_URL = 'http://localhost:3000/v1/webhook/whatsapp'

type CapturedRequest = {
  body: string
  signature: string
}

function createCapturingFetch(status = 200): { fetchImplementation: typeof fetch; captured: CapturedRequest[] } {
  const captured: CapturedRequest[] = []

  const fetchImplementation = (async (_url: string, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string>
    captured.push({ body: String(init?.body), signature: headers['x-hub-signature-256'] ?? '' })
    return { ok: status >= 200 && status < 300, status } as Response
  }) as unknown as typeof fetch

  return { fetchImplementation, captured }
}

describe('createPreviewWebhookClient', () => {
  it('assina com o mesmo HMAC que o servidor calcula em node:crypto', async () => {
    const { fetchImplementation, captured } = createCapturingFetch()
    const client = createPreviewWebhookClient({
      webhookUrl: WEBHOOK_URL,
      appSecret: APP_SECRET,
      from: FROM,
      fetchImplementation,
    })

    await client.sendText('quero 2kg de arroz')

    const request = captured[0]
    const expected = `sha256=${createHmac('sha256', APP_SECRET)
      .update(request?.body ?? '')
      .digest('hex')}`
    expect(request?.signature).toBe(expected)
  })

  it('envia exatamente os bytes que assinou', async () => {
    const { fetchImplementation, captured } = createCapturingFetch()
    const client = createPreviewWebhookClient({
      webhookUrl: WEBHOOK_URL,
      appSecret: APP_SECRET,
      from: FROM,
      fetchImplementation,
    })

    await client.sendButtonReply({ id: 'confirmar', title: 'Confirmar' })

    const request = captured[0]
    const reparsed = JSON.stringify(JSON.parse(request?.body ?? '{}'))
    expect(request?.body).toBe(reparsed)
  })

  it('mensagens de texto idêntico produzem assinaturas distintas', async () => {
    const { fetchImplementation, captured } = createCapturingFetch()
    const client = createPreviewWebhookClient({
      webhookUrl: WEBHOOK_URL,
      appSecret: APP_SECRET,
      from: FROM,
      fetchImplementation,
    })

    await client.sendText('sim')
    await client.sendText('sim')

    expect(captured[0]?.signature).not.toBe(captured[1]?.signature)
  })

  it('propaga a recusa do webhook em vez de engolir', async () => {
    const { fetchImplementation } = createCapturingFetch(401)
    const client = createPreviewWebhookClient({
      webhookUrl: WEBHOOK_URL,
      appSecret: APP_SECRET,
      from: FROM,
      fetchImplementation,
    })

    await expect(client.sendText('oi')).rejects.toBeInstanceOf(PreviewWebhookRejectedError)
  })
})

describe('assertPreviewEnvironment', () => {
  it('recusa montar em produção', () => {
    expect(() => assertPreviewEnvironment(true)).toThrow(PreviewInProductionError)
    expect(() => assertPreviewEnvironment(false)).not.toThrow()
  })
})
