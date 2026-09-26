/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * T306 (RF14, RF8): o parse do MIME multipart — corpo de texto e anexos, cada um conferido pela
 * mesma assinatura de bytes que o RF8 já usa (T210, `attachmentType.ts`) e pelo teto do canal
 * `email` (`CHANNEL_CAPABILITIES`). Anexo que mente sobre o tipo, ou passa do teto, é recusado —
 * contado em `skippedAttachments`, nunca lançado: quem decide se a mensagem inteira falha é o host.
 * Vermelho até `emailMime.ts` existir.
 */
import { describe, expect, it } from 'bun:test'

import { getChannelCapabilities } from '@adatechnology/conversation-contracts'

import { parseEmailMime } from './emailMime'

const BOUNDARY = 'boundary-conversation-module-t306'

function buildRawMime(parts: readonly string[]): Uint8Array {
  const body = parts.map((part) => `--${BOUNDARY}\r\n${part}`).join('') + `--${BOUNDARY}--\r\n`
  const headers =
    'From: sender@example.com\r\n' +
    'To: receiver@example.com\r\n' +
    'Subject: T306\r\n' +
    'MIME-Version: 1.0\r\n' +
    `Content-Type: multipart/mixed; boundary="${BOUNDARY}"\r\n` +
    '\r\n'
  return new TextEncoder().encode(headers + body)
}

function textPart(text: string): string {
  return `Content-Type: text/plain; charset=utf-8\r\n\r\n${text}\r\n`
}

function attachmentPart(input: {
  readonly contentType: string
  readonly fileName: string
  readonly bytes: Uint8Array
  readonly disposition?: string
}): string {
  const base64 = Buffer.from(input.bytes).toString('base64')
  const disposition = input.disposition ?? 'attachment'
  return (
    `Content-Type: ${input.contentType}; name="${input.fileName}"\r\n` +
    `Content-Disposition: ${disposition}; filename="${input.fileName}"\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    `${base64}\r\n`
  )
}

const REAL_PDF_BYTES = new TextEncoder().encode('%PDF-1.4\nconteudo de teste do anexo\n%%EOF')

describe('parseEmailMime', () => {
  it('devolve o corpo de texto e o anexo cujo tipo declarado bate com os bytes', async () => {
    const raw = buildRawMime([
      textPart('Corpo da mensagem em texto simples.'),
      attachmentPart({ contentType: 'application/pdf', fileName: 'documento.pdf', bytes: REAL_PDF_BYTES }),
    ])

    const parsed = await parseEmailMime(raw)

    expect(parsed.bodyText.trim()).toBe('Corpo da mensagem em texto simples.')
    expect(parsed.attachments).toHaveLength(1)
    expect(parsed.attachments[0]?.contentType).toBe('application/pdf')
    expect(parsed.attachments[0]?.fileName).toBe('documento.pdf')
    expect(parsed.attachments[0]?.bytes).toEqual(REAL_PDF_BYTES)
    expect(parsed.skippedAttachments).toBe(0)
  })

  it('recusa o anexo que mente sobre o tipo — os bytes não são de PDF (RF8)', async () => {
    const lyingBytes = new TextEncoder().encode('isto não é um PDF de verdade')
    const raw = buildRawMime([
      textPart('Corpo.'),
      attachmentPart({ contentType: 'application/pdf', fileName: 'falso.pdf', bytes: lyingBytes }),
    ])

    const parsed = await parseEmailMime(raw)

    expect(parsed.attachments).toHaveLength(0)
    expect(parsed.skippedAttachments).toBe(1)
  })

  it('parte inline (ex.: logo da assinatura) não vira anexo', async () => {
    const raw = buildRawMime([
      textPart('Corpo.'),
      attachmentPart({
        contentType: 'image/png',
        fileName: 'logo.png',
        bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0]),
        disposition: 'inline',
      }),
    ])

    const parsed = await parseEmailMime(raw)

    expect(parsed.attachments).toHaveLength(0)
    expect(parsed.skippedAttachments).toBe(0)
  })

  it('anexo acima do teto do canal email é recusado, contado em skippedAttachments', async () => {
    const maxBytes = getChannelCapabilities('email').attachments.maxBytes
    const oversized = new Uint8Array(maxBytes + 1024)
    oversized.set(REAL_PDF_BYTES)

    const raw = buildRawMime([
      textPart('Corpo.'),
      attachmentPart({ contentType: 'application/pdf', fileName: 'grande.pdf', bytes: oversized }),
    ])

    const parsed = await parseEmailMime(raw)

    expect(parsed.attachments).toHaveLength(0)
    expect(parsed.skippedAttachments).toBe(1)
  })

  it('content-type com variação de grafia (image/jpg) normaliza para a forma canônica', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0])
    const raw = buildRawMime([
      textPart('Corpo.'),
      attachmentPart({ contentType: 'image/jpg', fileName: 'foto.jpg', bytes: jpeg }),
    ])

    const parsed = await parseEmailMime(raw)

    expect(parsed.attachments).toHaveLength(1)
    expect(parsed.attachments[0]?.contentType).toBe('image/jpeg')
  })
})
