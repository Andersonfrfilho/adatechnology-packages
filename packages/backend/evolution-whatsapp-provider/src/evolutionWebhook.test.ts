/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, test } from 'bun:test'

import { parseEvolutionWebhook, verifyEvolutionWebhookSecret } from './evolutionWebhook'

describe('parseEvolutionWebhook', () => {
  test('an incoming text message becomes a message event with digits-only sender', () => {
    const events = parseEvolutionWebhook({
      data: {
        key: { fromMe: false, id: 'ABC', remoteJid: '5516999998888@s.whatsapp.net' },
        message: { conversation: 'oi' },
        messageTimestamp: 1_761_000_000,
        pushName: 'Maria',
      },
      event: 'messages.upsert',
    })

    expect(events).toEqual([
      {
        externalMessageId: 'ABC',
        from: '5516999998888',
        fromMe: false,
        pushName: 'Maria',
        text: 'oi',
        timestamp: 1_761_000_000,
        type: 'message',
      },
    ])
  })

  test('delivery acks map to the same vocabulary as the Meta channel', () => {
    const statuses = ['SERVER_ACK', 'DELIVERY_ACK', 'READ', 'ERROR'].map(
      (status) => parseEvolutionWebhook({ data: { keyId: 'ABC', status }, event: 'MESSAGES_UPDATE' })[0],
    )

    expect(statuses).toEqual([
      { externalMessageId: 'ABC', status: 'sent', type: 'status' },
      { externalMessageId: 'ABC', status: 'delivered', type: 'status' },
      { externalMessageId: 'ABC', status: 'read', type: 'status' },
      { externalMessageId: 'ABC', status: 'failed', type: 'status' },
    ])
  })

  test('connection updates and unknown events never throw', () => {
    expect(parseEvolutionWebhook({ data: { state: 'open' }, event: 'connection.update' })).toEqual([
      { state: 'open', type: 'connection' },
    ])
    expect(parseEvolutionWebhook({ data: {}, event: 'presence.update' })).toEqual([
      { event: 'presence.update', type: 'ignored' },
    ])
    expect(parseEvolutionWebhook('lixo')).toEqual([{ event: 'invalid', type: 'ignored' }])
  })
})

describe('verifyEvolutionWebhookSecret', () => {
  test('accepts only the exact secret', () => {
    expect(verifyEvolutionWebhookSecret('segredo', 'segredo')).toBe(true)
    expect(verifyEvolutionWebhookSecret('segredo2', 'segredo')).toBe(false)
    expect(verifyEvolutionWebhookSecret(undefined, 'segredo')).toBe(false)
    expect(verifyEvolutionWebhookSecret('x', '')).toBe(false)
  })
})
