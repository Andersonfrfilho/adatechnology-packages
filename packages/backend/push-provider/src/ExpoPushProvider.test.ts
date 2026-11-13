/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createExpoPushProvider, sendExpoPushBatch } from './ExpoPushProvider'
import type { ExpoPushMessage, ExpoPushTicket } from './expoTypes'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function messages(count: number): ExpoPushMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    to: `ExponentPushToken[${index}]`,
    title: 'Pedido atualizado',
    body: 'Seu pedido saiu para entrega',
  }))
}

describe('sendExpoPushBatch', () => {
  it('divide mais de 100 mensagens em chamadas separadas de até 100', async () => {
    const requestSizes: number[] = []
    const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as unknown[]
      requestSizes.push(body.length)
      const tickets: ExpoPushTicket[] = body.map((_, index) => ({ status: 'ok', id: `ticket-${index}` }))
      return jsonResponse(200, { data: tickets })
    }) as unknown as typeof fetch

    const results = await sendExpoPushBatch(messages(250), { fetchImpl })

    expect(requestSizes).toEqual([100, 100, 50])
    expect(results).toHaveLength(250)
    expect(results.every((result) => result.outcome === 'sent')).toBe(true)
  })

  it('classifica cada ticket de erro pelo código da Expo', async () => {
    const fetchImpl = (async () =>
      jsonResponse(200, {
        data: [
          { status: 'ok', id: 'ticket-1' },
          { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } },
          { status: 'error', message: 'slow down', details: { error: 'MessageRateExceeded' } },
          { status: 'error', message: 'too big', details: { error: 'MessageTooBig' } },
        ],
      })) as unknown as typeof fetch

    const results = await sendExpoPushBatch(messages(4), { fetchImpl })

    expect(results.map((result) => result.outcome)).toEqual(['sent', 'invalid_target', 'retriable', 'permanent'])
  })

  it('trata falha HTTP como resultado único aplicado a todo o lote', async () => {
    const rateLimited = (async () => jsonResponse(429, {})) as unknown as typeof fetch
    const badRequest = (async () => jsonResponse(400, {})) as unknown as typeof fetch

    const retriable = await sendExpoPushBatch(messages(2), { fetchImpl: rateLimited })
    const permanent = await sendExpoPushBatch(messages(2), { fetchImpl: badRequest })

    expect(retriable.every((result) => result.outcome === 'retriable')).toBe(true)
    expect(permanent.every((result) => result.outcome === 'permanent')).toBe(true)
  })
})

describe('createExpoPushProvider', () => {
  it('envia uma única mensagem e devolve o resultado dela', async () => {
    const fetchImpl = (async () =>
      jsonResponse(200, { data: [{ status: 'ok', id: 'ticket-1' }] })) as unknown as typeof fetch
    const provider = createExpoPushProvider({ fetchImpl })

    const result = await provider.send({
      token: 'ExponentPushToken[abc]',
      platform: 'android',
      title: 'Oi',
      body: 'Teste',
    })

    expect(result).toEqual({ outcome: 'sent', providerMessageId: 'ticket-1' })
  })
})
