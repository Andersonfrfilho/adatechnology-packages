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
  PreviewMediaUploadRejectedError,
  PreviewWebhookRejectedError,
} from './createPreviewWebhookClient'
import { PREVIEW_MEDIA_ID_PREFIX } from './createPreviewMediaUploader'

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

/**
 * O microfone do simulador depende disto existir no cliente.
 *
 * Enquanto o upload era prop de quem montava a tela, um produto tinha gravador e o outro não — e a
 * diferença não aparecia em teste nenhum, porque cada host montava o seu. Aqui a garantia é do
 * pacote: cliente montado, upload assinado, id prefixado.
 */
describe('createPreviewWebhookClient.uploadMedia', () => {
  function createUploadFetch(status = 201): {
    fetchImplementation: typeof fetch
    calls: Array<{ url: string; signature: string; body: string }>
  } {
    const calls: Array<{ url: string; signature: string; body: string }> = []

    const fetchImplementation = (async (url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>
      calls.push({ url: String(url), signature: headers['x-preview-signature'] ?? '', body: String(init?.body) })
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => ({ data: { uploadId: 'upl_123' } }),
      } as Response
    }) as unknown as typeof fetch

    return { fetchImplementation, calls }
  }

  const audioFile = () => new File([new Uint8Array([1, 2, 3])], 'nota.ogg', { type: 'audio/ogg' })

  it('sobe na mesma origem do webhook e devolve o id já prefixado', async () => {
    const { fetchImplementation, calls } = createUploadFetch()
    const client = createPreviewWebhookClient({
      webhookUrl: WEBHOOK_URL,
      appSecret: APP_SECRET,
      from: FROM,
      fetchImplementation,
    })

    const uploaded = await client.uploadMedia(audioFile())

    expect(calls[0]?.url).toBe('http://localhost:3000/v1/preview/media')
    expect(uploaded.mediaId).toBe(`${PREVIEW_MEDIA_ID_PREFIX}upl_123`)
    expect(uploaded.mimeType).toBe('audio/ogg')
  })

  it('assina o MIME com o mesmo HMAC que o servidor confere', async () => {
    const { fetchImplementation, calls } = createUploadFetch()
    const client = createPreviewWebhookClient({
      webhookUrl: WEBHOOK_URL,
      appSecret: APP_SECRET,
      from: FROM,
      fetchImplementation,
    })

    await client.uploadMedia(audioFile())

    const expected = `sha256=${createHmac('sha256', APP_SECRET).update('audio/ogg').digest('hex')}`
    expect(calls[0]?.signature).toBe(expected)
  })

  it('usa caminho relativo quando a URL do webhook não tem origem', async () => {
    const { fetchImplementation, calls } = createUploadFetch()
    const client = createPreviewWebhookClient({
      webhookUrl: '/v1/webhook/whatsapp',
      appSecret: APP_SECRET,
      from: FROM,
      fetchImplementation,
    })

    await client.uploadMedia(audioFile())

    expect(calls[0]?.url).toBe('/v1/preview/media')
  })

  it('avisa com erro próprio quando a rota de mídia recusa', async () => {
    const { fetchImplementation } = createUploadFetch(404)
    const client = createPreviewWebhookClient({
      webhookUrl: WEBHOOK_URL,
      appSecret: APP_SECRET,
      from: FROM,
      fetchImplementation,
    })

    await expect(client.uploadMedia(audioFile())).rejects.toBeInstanceOf(PreviewMediaUploadRejectedError)
  })
})
