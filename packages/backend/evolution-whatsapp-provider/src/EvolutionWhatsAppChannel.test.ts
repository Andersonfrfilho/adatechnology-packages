/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, test } from 'bun:test'

import { EvolutionWhatsAppChannel, normalizeEvolutionNumber } from './EvolutionWhatsAppChannel'
import { EvolutionError, EvolutionUnsupportedError } from './errors'

type Call = { url: string; init: RequestInit }

function fixture(responder: (call: Call) => Response) {
  const calls: Call[] = []
  const channel = new EvolutionWhatsAppChannel({
    apiKey: 'fixture-key',
    baseUrl: 'https://evolution.example/',
    instance: 'empresa 1',
    fetch: async (url, init) => {
      const call = { init, url }
      calls.push(call)
      return responder(call)
    },
  })
  return { calls, channel }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

/** A forma que a ponte `createWhatsAppDriverFromChannel` exige: o canal precisa satisfazê-la por estrutura. */
type SendingChannel = {
  sendText(to: string, body: string): Promise<{ externalMessageId: string | null }>
  sendTemplate(params: {
    to: string
    templateName: string
    languageCode: string
    bodyParameters?: string[]
  }): Promise<{ externalMessageId: string | null }>
}

describe('EvolutionWhatsAppChannel', () => {
  test('satisfies the notification bridge channel shape', () => {
    const channel: SendingChannel = new EvolutionWhatsAppChannel({
      apiKey: 'k',
      baseUrl: 'https://e.example',
      instance: 'i',
    })
    expect(typeof channel.sendText).toBe('function')
  })

  test('sendText posts digits-only number and returns the provider message id', async () => {
    const { calls, channel } = fixture(() => json({ key: { id: 'MSG1' } }))

    const result = await channel.sendText('+55 (16) 99999-8888', 'oi')

    expect(result).toEqual({ externalMessageId: 'MSG1' })
    expect(calls[0]?.url).toBe('https://evolution.example/message/sendText/empresa%201')
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ number: '5516999998888', text: 'oi' })
    expect((calls[0]?.init.headers as Record<string, string>).apikey).toBe('fixture-key')
  })

  test('sendMedia sends the buffer as base64 with document type for a pdf', async () => {
    const { calls, channel } = fixture(() => json({ key: { id: 'MSG2' } }))

    await channel.sendMedia({
      buffer: Buffer.from('%PDF-1'),
      caption: 'Boleto',
      filename: 'boleto.pdf',
      mimeType: 'application/pdf',
      to: '5516999998888',
    })

    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      caption: 'Boleto',
      fileName: 'boleto.pdf',
      media: Buffer.from('%PDF-1').toString('base64'),
      mediatype: 'document',
      mimetype: 'application/pdf',
      number: '5516999998888',
    })
  })

  test('sendMedia and sendTemplate refuse what Evolution cannot do, with a definitive error', async () => {
    const { channel } = fixture(() => json({}))

    await expect(
      channel.sendMedia({ filename: 'a.pdf', mediaId: 'm1', mimeType: 'application/pdf', to: '5516999998888' }),
    ).rejects.toBeInstanceOf(EvolutionUnsupportedError)
    await expect(channel.sendTemplate()).rejects.toMatchObject({ statusCode: 400 })
  })

  test('http failures carry statusCode, network failures do not', async () => {
    const http = fixture(() => json({}, 503))
    await expect(http.channel.sendText('5516999998888', 'oi')).rejects.toMatchObject({ statusCode: 503 })

    const network = new EvolutionWhatsAppChannel({
      apiKey: 'k',
      baseUrl: 'https://e.example',
      fetch: async () => {
        throw new Error('ECONNRESET')
      },
      instance: 'i',
    })
    const error = await network.sendText('5516999998888', 'oi').catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(EvolutionError)
    expect((error as EvolutionError).statusCode).toBeUndefined()
  })

  test('connection state and qr code are read from the instance endpoints', async () => {
    const { channel } = fixture(({ url }) =>
      url.includes('connectionState')
        ? json({ instance: { state: 'open' } })
        : json({ base64: 'data:image/png;base64,AAA', pairingCode: 'ABCD-1234' }),
    )

    expect(await channel.getConnectionState()).toBe('open')
    expect(await channel.getQrCode()).toEqual({ base64: 'data:image/png;base64,AAA', pairingCode: 'ABCD-1234' })
  })

  test('setWebhook points the instance at the url with the secret headers and the parsed events', async () => {
    const { calls, channel } = fixture(() => json({ webhook: { enabled: true } }, 201))

    await channel.setWebhook({ headers: { 'x-webhook-token': 'segredo' }, url: 'https://api.example/public/hook/1' })

    expect(calls[0]?.url).toBe('https://evolution.example/webhook/set/empresa%201')
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      webhook: {
        base64: false,
        byEvents: false,
        enabled: true,
        events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'],
        headers: { 'x-webhook-token': 'segredo' },
        url: 'https://api.example/public/hook/1',
      },
    })
  })

  test('rejects an obviously invalid number before calling the gateway', () => {
    expect(() => normalizeEvolutionNumber('123')).toThrow(EvolutionError)
  })
})
