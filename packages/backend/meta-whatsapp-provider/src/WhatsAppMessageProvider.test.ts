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
