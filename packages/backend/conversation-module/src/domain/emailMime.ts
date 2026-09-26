/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RF14, RF8: o MIME bruto interpretado — corpo de texto e anexos. Cada anexo passa pela mesma
 * conferência de tipo **pelo conteúdo** que o RF8 já usa (T210, `attachmentType.ts` — reaproveitada,
 * não reescrita) e pelo teto do canal `email` (`CHANNEL_CAPABILITIES`, T105). Anexo que mente sobre
 * o tipo, ou passa do teto, é recusado e contado em `skippedAttachments` — nunca lançado; quem
 * decide se a mensagem inteira falha é o host.
 *
 * O parser é `postal-mime`, já em uso no ecossistema para MIME recebido — reaproveitado em vez de um
 * parser de MIME escrito à mão. Parse só, sem I/O: quem grava o anexo (bucket, `sha256` final) é o
 * host, pela `ObjectStoragePort`.
 */
import PostalMime from 'postal-mime'

import { getChannelCapabilities } from '@adatechnology/conversation-contracts'

import { attachmentKindOf, matchesAttachmentSignature, normalizeAttachmentFileName } from './attachmentType'

const EMAIL_CHANNEL = 'email'

export type ParsedEmailAttachment = {
  readonly bytes: Uint8Array
  readonly contentType: string
  readonly fileName: string
}

export type ParsedEmailMime = {
  readonly bodyText: string
  readonly attachments: readonly ParsedEmailAttachment[]
  /** Quantos anexos foram recusados (tipo mentindo ou acima do teto do canal) — nunca o nome. */
  readonly skippedAttachments: number
}

/** Alguns clientes de e-mail escrevem o tipo com variação; o que vale é a forma canônica da lista fechada (RF8). */
function canonicalContentType(mimeType: string): string {
  const base = mimeType.split(';')[0]?.trim().toLowerCase() ?? ''
  return base === 'image/jpg' || base === 'image/pjpeg' ? 'image/jpeg' : base
}

function toBytes(content: ArrayBuffer | string | Uint8Array): Uint8Array {
  if (typeof content === 'string') return new TextEncoder().encode(content)
  return content instanceof Uint8Array ? content : new Uint8Array(content)
}

export async function parseEmailMime(rawMime: Uint8Array): Promise<ParsedEmailMime> {
  const capability = getChannelCapabilities(EMAIL_CHANNEL).attachments
  const parsed = await PostalMime.parse(rawMime, { attachmentEncoding: 'arraybuffer' })

  const attachments: ParsedEmailAttachment[] = []
  let skippedAttachments = 0

  for (const part of parsed.attachments) {
    if (part.disposition === 'inline') continue

    const contentType = canonicalContentType(part.mimeType)
    const bytes = toBytes(part.content)
    const fits =
      capability.accepted &&
      attachmentKindOf(contentType) !== undefined &&
      bytes.byteLength > 0 &&
      bytes.byteLength <= capability.maxBytes &&
      matchesAttachmentSignature(contentType, bytes)

    if (!fits) {
      skippedAttachments += 1
      continue
    }

    attachments.push({ bytes, contentType, fileName: normalizeAttachmentFileName(part.filename ?? '') })
  }

  return { bodyText: parsed.text ?? '', attachments, skippedAttachments }
}
