/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createSmtpEmailProvider } from './SmtpEmailProvider'
import type { SmtpTransportClient } from './SmtpTransportClient'

function fakeTransport(sendMail: SmtpTransportClient['sendMail']): SmtpTransportClient {
  return { sendMail }
}

const params = { to: 'cliente@example.com', subject: 'Oi', html: '<p>Oi</p>', text: 'Oi' }

describe('createSmtpEmailProvider', () => {
  it('envia e devolve o messageId do transporte', async () => {
    const provider = createSmtpEmailProvider({
      from: 'contato@ada.tech',
      transportClient: fakeTransport(async () => ({ messageId: '<abc@ada.tech>', accepted: ['x'], rejected: [] })),
    })

    const result = await provider.send(params)

    expect(result).toEqual({ outcome: 'sent', providerMessageId: '<abc@ada.tech>' })
  })

  it('trata rejeição sem exceção (aceito vazio, rejeitado não vazio) como invalid_target', async () => {
    const provider = createSmtpEmailProvider({
      from: 'contato@ada.tech',
      transportClient: fakeTransport(async () => ({
        messageId: '<x>',
        accepted: [],
        rejected: ['cliente@example.com'],
      })),
    })

    const result = await provider.send(params)

    expect(result.outcome).toBe('invalid_target')
  })

  it('classifica 550 (usuário desconhecido) como invalid_target', async () => {
    const provider = createSmtpEmailProvider({
      from: 'contato@ada.tech',
      transportClient: fakeTransport(async () => {
        throw { responseCode: 550, message: 'no such user' }
      }),
    })

    expect((await provider.send(params)).outcome).toBe('invalid_target')
  })

  it('classifica 4xx como retriable e outro 5xx como permanent', async () => {
    const retriableProvider = createSmtpEmailProvider({
      from: 'contato@ada.tech',
      transportClient: fakeTransport(async () => {
        throw { responseCode: 421 }
      }),
    })
    const permanentProvider = createSmtpEmailProvider({
      from: 'contato@ada.tech',
      transportClient: fakeTransport(async () => {
        throw { responseCode: 554 }
      }),
    })

    expect((await retriableProvider.send(params)).outcome).toBe('retriable')
    expect((await permanentProvider.send(params)).outcome).toBe('permanent')
  })

  it('sem smtpUrl e sem client, falha no boot em vez de na primeira notificação', async () => {
    const provider = createSmtpEmailProvider({ from: 'contato@ada.tech' })

    await expect(provider.send(params)).rejects.toThrow()
  })
})
