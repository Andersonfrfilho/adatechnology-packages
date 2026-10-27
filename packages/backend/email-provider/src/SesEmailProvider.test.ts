/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createSesEmailProvider } from './SesEmailProvider'
import type { SesSendClient } from './SesSendClient'

function fakeSesClient(
  sendEmail: SesSendClient['sendEmail'],
  sendRawEmail: SesSendClient['sendRawEmail'] = async () => ({ messageId: 'ses-raw' }),
): SesSendClient {
  return { sendEmail, sendRawEmail }
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

describe('createSesEmailProvider com anexo', () => {
  const anexo = {
    filename: 'nota.pdf',
    url: 'https://storage.exemplo.com/nota.pdf',
    contentType: 'application/pdf',
  } as const

  const buscaOk = (async () => new Response('%PDF conteudo', { status: 200 })) as unknown as typeof fetch
  const original = globalThis.fetch

  /** Sem anexo o caminho continua sendo o `Simple`: montar MIME a toa e assumir o trabalho da AWS. */
  it('sem anexo usa sendEmail, nao o MIME cru', async () => {
    let usouRaw = false
    const provider = createSesEmailProvider({
      from: 'contato@ada.tech',
      client: fakeSesClient(
        async () => ({ messageId: 'simples' }),
        async () => {
          usouRaw = true
          return { messageId: 'raw' }
        },
      ),
    })

    const result = await provider.send(params)

    expect(usouRaw).toBe(false)
    expect(result).toEqual({ outcome: 'sent', providerMessageId: 'simples' })
  })

  it('com anexo troca para o MIME cru', async () => {
    globalThis.fetch = buscaOk
    try {
      let raw: Uint8Array | undefined
      const provider = createSesEmailProvider({
        from: 'contato@ada.tech',
        client: fakeSesClient(
          async () => ({ messageId: 'simples' }),
          async ({ raw: bytes }) => {
            raw = bytes
            return { messageId: 'raw-1' }
          },
        ),
      })

      const result = await provider.send({ ...params, attachments: [anexo] })
      const mime = new TextDecoder().decode(raw)

      expect(result).toEqual({ outcome: 'sent', providerMessageId: 'raw-1' })
      expect(mime).toContain('Content-Disposition: attachment; filename="nota.pdf"')
    } finally {
      globalThis.fetch = original
    }
  })

  /** Assinatura vencida e storage fora se resolvem sozinhos numa nova tentativa. */
  it('anexo inalcancavel vira tentativa retriable com o motivo', async () => {
    globalThis.fetch = (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch

    try {
      const provider = createSesEmailProvider({
        from: 'contato@ada.tech',
        client: fakeSesClient(async () => ({ messageId: 'x' })),
      })

      expect(await provider.send({ ...params, attachments: [anexo] })).toEqual({
        outcome: 'retriable',
        errorCode: 'attachment_unreachable',
      })
    } finally {
      globalThis.fetch = original
    }
  })
})
