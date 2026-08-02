/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { subscribeToNotificationStream, type NotificationStreamEvent } from './streamSubscription'

function streamOf(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

function collectEvents(chunks: string[]): Promise<NotificationStreamEvent[]> {
  return new Promise((resolve) => {
    const received: NotificationStreamEvent[] = []
    const subscription = subscribeToNotificationStream({
      url: 'http://localhost/v1/notifications/stream',
      headers: { authorization: 'Bearer x' },
      reconnectDelayMs: 0,
      fetchImpl: (async () => streamOf(chunks)) as unknown as typeof fetch,
      onEvent: (event) => received.push(event),
    })

    // O stream fecha sozinho ao fim dos chunks; espera um tick para o loop drenar.
    setTimeout(() => {
      subscription.close()
      resolve(received)
    }, 20)
  })
}

describe('subscribeToNotificationStream', () => {
  it('lê evento nomeado com JSON', async () => {
    const events = await collectEvents(['event: unread-count\ndata: {"unreadCount":3}\n\n'])

    expect(events).toEqual([{ event: 'unread-count', data: { unreadCount: 3 } }])
  })

  it('ignora heartbeat (comentário SSE) sem virar evento no cliente', async () => {
    const events = await collectEvents([': heartbeat\n\n', 'event: ping\ndata: {"ok":true}\n\n'])

    expect(events).toHaveLength(1)
    expect(events[0]?.event).toBe('ping')
  })

  it('remonta evento partido entre dois chunks de rede', async () => {
    // O corte no meio de `data:` é o caso que quebra parser ingênuo — o buffer existe para isto.
    const events = await collectEvents(['event: notification.created\ndata: {"notif', 'icationId":"abc"}\n\n'])

    expect(events).toEqual([{ event: 'notification.created', data: { notificationId: 'abc' } }])
  })

  it('processa múltiplos eventos que chegam no mesmo chunk', async () => {
    const events = await collectEvents(['event: a\ndata: {"n":1}\n\nevent: b\ndata: {"n":2}\n\n'])

    expect(events.map((event) => event.event)).toEqual(['a', 'b'])
  })

  it('cai para `message` quando o servidor não nomeia o evento', async () => {
    const events = await collectEvents(['data: {"n":1}\n\n'])

    expect(events[0]?.event).toBe('message')
  })

  it('entrega texto cru quando o data não é JSON', async () => {
    const events = await collectEvents(['event: raw\ndata: nao-e-json\n\n'])

    expect(events[0]?.data).toBe('nao-e-json')
  })

  it('envia o header de autorização — token nunca vai por query string', async () => {
    let capturedUrl = ''
    let capturedHeaders: Record<string, string> = {}

    const subscription = subscribeToNotificationStream({
      url: 'http://localhost/v1/notifications/stream',
      headers: { authorization: 'Bearer segredo' },
      reconnectDelayMs: 0,
      onEvent: () => {},
      fetchImpl: (async (url: string, init?: RequestInit) => {
        capturedUrl = url
        capturedHeaders = init?.headers as Record<string, string>
        return streamOf([])
      }) as unknown as typeof fetch,
    })

    await new Promise((resolve) => setTimeout(resolve, 10))
    subscription.close()

    expect(capturedHeaders.authorization).toBe('Bearer segredo')
    expect(capturedUrl).not.toContain('segredo')
  })

  it('reporta erro de conexão sem derrubar o processo', async () => {
    const errors: Error[] = []
    const subscription = subscribeToNotificationStream({
      url: 'http://localhost/v1/notifications/stream',
      headers: {},
      reconnectDelayMs: 0,
      onEvent: () => {},
      onError: (error) => errors.push(error),
      fetchImpl: (async () => new Response(null, { status: 503 })) as unknown as typeof fetch,
    })

    await new Promise((resolve) => setTimeout(resolve, 10))
    subscription.close()

    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]?.message).toContain('503')
  })
})
