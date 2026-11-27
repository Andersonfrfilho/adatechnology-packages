/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { WhatsAppRejectionError, WhatsAppWindowExpiredError } from '@adatechnology/meta-graph-core'

import { WhatsAppMessageProvider } from './WhatsAppMessageProvider'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function buildProvider(): WhatsAppMessageProvider {
  return new WhatsAppMessageProvider({ accessToken: 'fixture-token', phoneNumberId: 'phone-1' })
}

function mockJsonResponseOnce(body: unknown, status = 200): { requestUrl: string; requestInit: RequestInit }[] {
  const calls: { requestUrl: string; requestInit: RequestInit }[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ requestUrl: String(input), requestInit: init ?? {} })
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  return calls
}

describe('WhatsAppMessageProvider.sendText', () => {
  test('posts a text message to the phone number messages endpoint', async () => {
    const calls = mockJsonResponseOnce({ messages: [{ id: 'wamid.1' }] })
    const provider = buildProvider()

    const result = await provider.sendText('5511999990000', 'olá')

    expect(result).toEqual({ waMessageId: 'wamid.1' })
    const [{ requestUrl, requestInit }] = calls
    expect(requestUrl).toBe('https://graph.facebook.com/v21.0/phone-1/messages')
    const payload = JSON.parse(String(requestInit.body))
    expect(payload).toMatchObject({ type: 'text', to: '5511999990000', text: { body: 'olá' } })
  })

  test('asks for the link card only when previewUrl is set', async () => {
    const calls = mockJsonResponseOnce({ messages: [{ id: 'wamid.1' }] })
    const provider = buildProvider()

    await provider.sendText('5511999990000', 'mapa: https://maps.google.com/?q=x', { previewUrl: true })

    const payload = JSON.parse(String(calls[0]?.requestInit.body))
    expect(payload.text).toMatchObject({ preview_url: true })
  })

  test('omits preview_url when the caller does not ask for the card', async () => {
    const calls = mockJsonResponseOnce({ messages: [{ id: 'wamid.1' }] })
    const provider = buildProvider()

    await provider.sendText('5511999990000', 'olá')

    const payload = JSON.parse(String(calls[0]?.requestInit.body))
    expect(payload.text).not.toHaveProperty('preview_url')
  })

  test('returns null waMessageId when the Graph API omits the messages array', async () => {
    mockJsonResponseOnce({})
    const provider = buildProvider()

    const result = await provider.sendText('5511999990000', 'olá')

    expect(result).toEqual({ waMessageId: null })
  })
})

describe('WhatsAppMessageProvider window-expired mapping', () => {
  test('maps a 24h-window Graph rejection into WhatsAppWindowExpiredError', async () => {
    mockJsonResponseOnce(
      { error: { code: 131047, message: 'Message failed to send because more than 24 hours have passed' } },
      400,
    )
    const provider = buildProvider()

    await expect(provider.sendText('5511999990000', 'olá')).rejects.toBeInstanceOf(WhatsAppWindowExpiredError)
  })

  test('does not remap unrelated Graph rejections', async () => {
    mockJsonResponseOnce({ error: { code: 100, message: 'Invalid parameter' } }, 400)
    const provider = buildProvider()

    await expect(provider.sendText('5511999990000', 'olá')).rejects.toBeInstanceOf(WhatsAppRejectionError)
  })
})

describe('WhatsAppMessageProvider.sendInteractiveButtons', () => {
  test('rejects when there are no buttons', async () => {
    const provider = buildProvider()

    await expect(
      provider.sendInteractiveButtons({ to: '5511999990000', bodyText: 'Escolha', buttons: [] }),
    ).rejects.toBeInstanceOf(WhatsAppRejectionError)
  })

  test('rejects when there are more than 3 buttons', async () => {
    const provider = buildProvider()

    await expect(
      provider.sendInteractiveButtons({
        to: '5511999990000',
        bodyText: 'Escolha',
        buttons: [
          { id: '1', title: 'Um' },
          { id: '2', title: 'Dois' },
          { id: '3', title: 'Três' },
          { id: '4', title: 'Quatro' },
        ],
      }),
    ).rejects.toBeInstanceOf(WhatsAppRejectionError)
  })

  test('sends a valid interactive buttons payload', async () => {
    const calls = mockJsonResponseOnce({ messages: [{ id: 'wamid.2' }] })
    const provider = buildProvider()

    const result = await provider.sendInteractiveButtons({
      to: '5511999990000',
      bodyText: 'Escolha',
      buttons: [{ id: 'sim', title: 'Sim' }],
    })

    expect(result).toEqual({ waMessageId: 'wamid.2' })
    const [{ requestInit }] = calls
    const payload = JSON.parse(String(requestInit.body)) as { interactive: { action: { buttons: unknown[] } } }
    expect(payload.interactive.action.buttons).toEqual([{ type: 'reply', reply: { id: 'sim', title: 'Sim' } }])
  })
})

describe('WhatsAppMessageProvider.sendLocation', () => {
  test('sends latitude, longitude and the pin labels', async () => {
    const calls = mockJsonResponseOnce({ messages: [{ id: 'wamid.loc' }] })
    const provider = buildProvider()

    const result = await provider.sendLocation({
      to: '5511999990000',
      latitude: -20.5386,
      longitude: -47.4008,
      name: 'Entrega',
      address: 'Rua Radialista Alfeu Stabelini, 6531',
    })

    expect(result).toEqual({ waMessageId: 'wamid.loc' })
    const [{ requestInit }] = calls
    const payload = JSON.parse(String(requestInit.body)) as { type: string; location: Record<string, unknown> }
    expect(payload.type).toBe('location')
    expect(payload.location).toEqual({
      latitude: -20.5386,
      longitude: -47.4008,
      name: 'Entrega',
      address: 'Rua Radialista Alfeu Stabelini, 6531',
    })
  })

  test('omits the labels when they are not given', async () => {
    const calls = mockJsonResponseOnce({ messages: [{ id: 'wamid.loc2' }] })
    const provider = buildProvider()

    await provider.sendLocation({ to: '5511999990000', latitude: 0, longitude: 0 })

    const [{ requestInit }] = calls
    const payload = JSON.parse(String(requestInit.body)) as { location: Record<string, unknown> }
    expect(payload.location).toEqual({ latitude: 0, longitude: 0 })
  })

  /*
   * Latitude e longitude trocadas de lugar é o erro clássico, e a Graph API aceita o corpo: o pino
   * simplesmente aparece em outro continente. Recusar aqui é o que torna o engano visível.
   */
  test('rejects coordinates outside the valid range', async () => {
    const provider = buildProvider()

    await expect(provider.sendLocation({ to: '5511999990000', latitude: -200, longitude: 0 })).rejects.toBeInstanceOf(
      WhatsAppRejectionError,
    )
    await expect(provider.sendLocation({ to: '5511999990000', latitude: 0, longitude: 200 })).rejects.toBeInstanceOf(
      WhatsAppRejectionError,
    )
  })
})

describe('WhatsAppMessageProvider.sendTemplate', () => {
  test('omits components when there are no body parameters', async () => {
    const calls = mockJsonResponseOnce({ messages: [{ id: 'wamid.3' }] })
    const provider = buildProvider()

    await provider.sendTemplate({ to: '5511999990000', templateName: 'boas_vindas' })

    const [{ requestInit }] = calls
    const payload = JSON.parse(String(requestInit.body)) as { template: Record<string, unknown> }
    expect(payload.template['components']).toBeUndefined()
    expect(payload.template['language']).toEqual({ code: 'pt_BR' })
  })

  test('builds a body component from the provided parameters', async () => {
    const calls = mockJsonResponseOnce({ messages: [{ id: 'wamid.4' }] })
    const provider = buildProvider()

    await provider.sendTemplate({ to: '5511999990000', templateName: 'confirmacao', bodyParameters: ['João', '10h'] })

    const [{ requestInit }] = calls
    const payload = JSON.parse(String(requestInit.body)) as { template: { components: unknown[] } }
    expect(payload.template.components).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'João' },
          { type: 'text', text: '10h' },
        ],
      },
    ])
  })
})

describe('WhatsAppMessageProvider.sendMedia as sticker', () => {
  function mockUploadAndSend(): { requestUrl: string; requestInit: RequestInit }[] {
    const calls: { requestUrl: string; requestInit: RequestInit }[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      calls.push({ requestUrl: String(input), requestInit: init ?? {} })
      const body = String(input).endsWith('/media') ? { id: 'media-9' } : { messages: [{ id: 'wamid.9' }] }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
    return calls
  }

  test('uploads the webp and sends it as type sticker, without caption', async () => {
    const calls = mockUploadAndSend()

    const result = await buildProvider().sendMedia({
      to: '5511999990000',
      mimeType: 'image/webp',
      filename: 'sticker.webp',
      caption: 'ignored',
      buffer: Buffer.from('RIFF'),
      asSticker: true,
    })

    expect(result).toEqual({ waMessageId: 'wamid.9', mediaId: 'media-9' })
    const payload = JSON.parse(String(calls[1]?.requestInit.body))
    expect(payload).toMatchObject({ type: 'sticker', to: '5511999990000', sticker: { id: 'media-9' } })
    expect(payload.sticker).not.toHaveProperty('caption')
  })

  test('sends a known mediaId as sticker without uploading again', async () => {
    const calls = mockUploadAndSend()

    await buildProvider().sendMedia({
      to: '5511999990000',
      mimeType: 'image/webp',
      filename: 'sticker.webp',
      mediaId: 'media-1',
      asSticker: true,
    })

    expect(calls).toHaveLength(1)
    expect(JSON.parse(String(calls[0]?.requestInit.body))).toMatchObject({
      type: 'sticker',
      sticker: { id: 'media-1' },
    })
  })

  test('refuses a sticker that is not webp before calling the Meta', async () => {
    const calls = mockUploadAndSend()

    await expect(
      buildProvider().sendMedia({
        to: '5511999990000',
        mimeType: 'image/png',
        filename: 'logo.png',
        buffer: Buffer.from('x'),
        asSticker: true,
      }),
    ).rejects.toThrow('image/webp')
    expect(calls).toHaveLength(0)
  })

  test('keeps sending webp as an image when not asked for a sticker', async () => {
    const calls = mockUploadAndSend()

    await buildProvider().sendMedia({
      to: '5511999990000',
      mimeType: 'image/webp',
      filename: 'a.webp',
      mediaId: 'media-2',
    })

    expect(JSON.parse(String(calls[0]?.requestInit.body))).toMatchObject({ type: 'image' })
  })
})
