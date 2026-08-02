/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createSesEmailProvider } from './SesEmailProvider'
import type { SesSendClient } from './SesSendClient'

function fakeSesClient(sendEmail: SesSendClient['sendEmail']): SesSendClient {
  return { sendEmail }
}

const params = { to: 'cliente@example.com', subject: 'Oi', html: '<p>Oi</p>', text: 'Oi' }

describe('createSesEmailProvider', () => {
  it('envia e devolve o messageId do provedor', async () => {
    const provider = createSesEmailProvider({
      from: 'contato@ada.tech',
      client: fakeSesClient(async () => ({ messageId: 'ses-message-1' })),
    })

    const result = await provider.send(params)

    expect(result).toEqual({ outcome: 'sent', providerMessageId: 'ses-message-1' })
  })

  it('classifica TooManyRequestsException como retriable', async () => {
    const provider = createSesEmailProvider({
      from: 'contato@ada.tech',
      client: fakeSesClient(async () => {
        throw { name: 'TooManyRequestsException' }
      }),
    })

    expect((await provider.send(params)).outcome).toBe('retriable')
  })

  it('classifica MessageRejected e MailFromDomainNotVerifiedException como permanent', async () => {
    const rejectedProvider = createSesEmailProvider({
      from: 'contato@ada.tech',
      client: fakeSesClient(async () => {
        throw { name: 'MessageRejected' }
      }),
    })
    const domainProvider = createSesEmailProvider({
      from: 'contato@ada.tech',
      client: fakeSesClient(async () => {
        throw { name: 'MailFromDomainNotVerifiedException' }
      }),
    })

    expect((await rejectedProvider.send(params)).outcome).toBe('permanent')
    expect((await domainProvider.send(params)).outcome).toBe('permanent')
  })

  it('sem region e sem client, falha no boot em vez de na primeira notificação', async () => {
    const provider = createSesEmailProvider({ from: 'contato@ada.tech' })

    await expect(provider.send(params)).rejects.toThrow()
  })
})
