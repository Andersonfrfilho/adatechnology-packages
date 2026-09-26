/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RF8: a regra pura do tipo do anexo — sem I/O, sem produto. Porta de
 * `conversation-attachment.policy.ts` (spec 183): o vocabulário fechado de tipo, a assinatura de
 * bytes (RF8: "o tipo que vale é o dos bytes") e a normalização do nome de arquivo. O teto por
 * canal **não** foi portado — a T105 já decidiu isso em `CHANNEL_CAPABILITIES.attachments`, uma
 * fonte só, sem tabela `(canal × tipo)` própria deste arquivo.
 */
import type { AttachmentKind } from '@adatechnology/conversation-contracts'

export const ATTACHMENT_CONTENT_TYPE_KINDS: Readonly<Record<string, AttachmentKind>> = {
  'application/pdf': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'text/csv': 'document',
  'audio/mp4': 'audio',
  'audio/mpeg': 'audio',
  'audio/ogg': 'audio',
  'audio/webm': 'audio',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
}

export function attachmentKindOf(contentType: string): AttachmentKind | undefined {
  return ATTACHMENT_CONTENT_TYPE_KINDS[contentType]
}

function startsWith(bytes: Uint8Array, prefix: readonly number[], offset = 0): boolean {
  return prefix.every((value, index) => bytes[offset + index] === value)
}

function ascii(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0))
}

function includesAscii(bytes: Uint8Array, text: string, limit = 4096): boolean {
  const window = bytes.subarray(0, limit)
  let content = ''
  for (const byte of window) content += String.fromCharCode(byte)
  return content.includes(text)
}

/** Texto de verdade: UTF-8 válido e sem byte nulo nos primeiros 4 KiB. */
function looksLikeText(bytes: Uint8Array): boolean {
  const window = bytes.subarray(0, 4096)
  if (window.includes(0)) return false
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(window)
    return true
  } catch {
    return false
  }
}

/** O tipo declarado bate com os bytes? A única conferência de tipo que vale (RF8). */
export function matchesAttachmentSignature(contentType: string, bytes: Uint8Array): boolean {
  switch (contentType) {
    case 'application/pdf':
      return startsWith(bytes, ascii('%PDF-'))
    case 'image/jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff])
    case 'image/png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/webp':
      return startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      /** XLSX é um ZIP; o que o distingue de outro ZIP (DOCX, qualquer um) é a pasta `xl/`. */
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && includesAscii(bytes, 'xl/', 64 * 1024)
    case 'application/vnd.ms-excel':
      return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    case 'text/csv':
      return looksLikeText(bytes)
    case 'audio/ogg':
      return startsWith(bytes, ascii('OggS'))
    case 'audio/mpeg':
      return startsWith(bytes, ascii('ID3')) || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0)
    case 'audio/mp4':
      return startsWith(bytes, ascii('ftyp'), 4)
    case 'audio/webm':
      return startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])
    default:
      return false
  }
}

/** O teto do nome de arquivo exposto a quem baixa. */
export const ATTACHMENT_FILE_NAME_MAX_LENGTH = 200

/**
 * O nome como vai aparecer para quem baixa: só a última parte de um caminho, sem caractere de
 * controle, aparado e com teto. Vazio vira "anexo". Nunca vai a log.
 */
export function normalizeAttachmentFileName(fileName: string): string {
  const lastSegment = fileName.split(/[/\\]/u).at(-1) ?? ''
  // eslint-disable-next-line no-control-regex
  const clean = lastSegment.replace(/[\u0000-\u001f\u007f]/gu, '').trim()
  const name = clean === '' || clean === '.' || clean === '..' ? 'anexo' : clean
  return name.slice(0, ATTACHMENT_FILE_NAME_MAX_LENGTH)
}
