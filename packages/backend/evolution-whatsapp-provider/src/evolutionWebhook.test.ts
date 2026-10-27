/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, test } from 'bun:test'

import { evolutionWebhookInstance, parseEvolutionWebhook, verifyEvolutionWebhookSecret } from './evolutionWebhook'

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
        chat: 'user',
        externalMessageId: 'ABC',
        from: '5516999998888',
        fromMe: false,
        pushName: 'Maria',
        replyToExternalMessageId: null,
        text: 'oi',
        timestamp: 1_761_000_000,
        type: 'message',
      },
    ])
  })

  test('a reply carries the quoted message id, from any message type', () => {
    const [extended] = parseEvolutionWebhook({
      data: {
        key: { fromMe: false, id: 'R1', remoteJid: '5516999998888@s.whatsapp.net' },
        message: { extendedTextMessage: { contextInfo: { stanzaId: 'SENT-1' }, text: 'recebi' } },
      },
      event: 'messages.upsert',
    })
    const [topLevel] = parseEvolutionWebhook({
      data: {
        contextInfo: { stanzaId: 'SENT-2' },
        key: { fromMe: false, id: 'R2', remoteJid: '5516999998888@s.whatsapp.net' },
        message: { conversation: 'ok' },
      },
      event: 'messages.upsert',
    })

    expect(extended).toMatchObject({ replyToExternalMessageId: 'SENT-1', text: 'recebi' })
    expect(topLevel).toMatchObject({ replyToExternalMessageId: 'SENT-2', text: 'ok' })
  })

  test('media captions are the text, including the wrapped document', () => {
    const texts = [
      { imageMessage: { caption: 'foto do canhoto' } },
      { documentWithCaptionMessage: { message: { documentMessage: { caption: 'boleto pago' } } } },
      { audioMessage: { seconds: 3 } },
    ].map(
      (message) =>
        parseEvolutionWebhook({
          data: { key: { id: 'M', remoteJid: '5516999998888@s.whatsapp.net' }, message },
          event: 'messages.upsert',
        })[0],
    )

    expect(texts.map((event) => (event?.type === 'message' ? event.text : undefined))).toEqual([
      'foto do canhoto',
      'boleto pago',
      null,
    ])
  })

  test('groups, status broadcasts and bare lids have no phone number', () => {
    const chats = ['120363000000000000@g.us', 'status@broadcast', '123456789012345@lid'].map(
      (remoteJid) => parseEvolutionWebhook({ data: { key: { id: 'G', remoteJid } }, event: 'messages.upsert' })[0],
    )

    expect(chats.map((event) => (event?.type === 'message' ? [event.chat, event.from] : undefined))).toEqual([
      ['group', ''],
      ['broadcast', ''],
      ['lid', ''],
    ])
  })

  test('a lid chat with the alternative phone jid is a user with that number', () => {
    const [event] = parseEvolutionWebhook({
      data: {
        key: { id: 'L', remoteJid: '123456789012345@lid', remoteJidAlt: '5516999998888@s.whatsapp.net' },
        messageTimestamp: '1761000000',
      },
      event: 'messages.upsert',
    })

    expect(event).toMatchObject({ chat: 'user', from: '5516999998888', timestamp: 1_761_000_000 })
  })

  test('the instance name is read apart from the events', () => {
    expect(evolutionWebhookInstance({ event: 'messages.upsert', instance: 'empresa-1' })).toBe('empresa-1')
    expect(evolutionWebhookInstance({ event: 'messages.upsert' })).toBeNull()
    expect(evolutionWebhookInstance('lixo')).toBeNull()
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
