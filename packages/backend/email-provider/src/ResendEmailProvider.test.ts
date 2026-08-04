/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createResendEmailProvider } from './ResendEmailProvider'
import type { ResendClientLike } from './ResendClient'

function fakeResend(send: ResendClientLike['emails']['send']): ResendClientLike {
  return { emails: { send } }
}

const params = { to: 'cliente@example.com', subject: 'Oi', html: '<p>Oi</p>', text: 'Oi' }

describe('createResendEmailProvider', () => {
  it('envia e devolve o id do provedor', async () => {
    const provider = createResendEmailProvider({
      from: 'contato@ada.tech',
      client: fakeResend(async () => ({ data: { id: 'email_123' }, error: null })),
    })

    const result = await provider.send(params)

    expect(result).toEqual({ outcome: 'sent', providerMessageId: 'email_123' })
  })

  it('a Resend não lança em erro de negócio — o driver lê error.name, não uma exceção', async () => {
    const provider = createResendEmailProvider({
      from: 'contato@ada.tech',
      client: fakeResend(async () => ({
        data: null,
        error: { name: 'rate_limit_exceeded', message: 'slow down', statusCode: 429 },
      })),
    })

    const result = await provider.send(params)

    expect(result).toEqual({ outcome: 'retriable', errorCode: 'rate_limit_exceeded' })
  })

  it('classifica validação/config como permanent', async () => {
    const provider = createResendEmailProvider({
      from: 'contato@ada.tech',
      client: fakeResend(async () => ({
        data: null,
        error: { name: 'invalid_from_address', message: 'bad from', statusCode: 422 },
      })),
    })

    expect((await provider.send(params)).outcome).toBe('permanent')
  })

  it('classifica statusCode >= 500 como retriable mesmo com nome desconhecido', async () => {
    const provider = createResendEmailProvider({
      from: 'contato@ada.tech',
      client: fakeResend(async () => ({
        data: null,
        error: { name: 'application_error', message: 'boom', statusCode: 500 },
      })),
    })

    expect((await provider.send(params)).outcome).toBe('retriable')
  })

  it('sem apiKey e sem client, falha no boot em vez de na primeira notificação', async () => {
    const provider = createResendEmailProvider({ from: 'contato@ada.tech' })

    await expect(provider.send(params)).rejects.toThrow()
  })
})
