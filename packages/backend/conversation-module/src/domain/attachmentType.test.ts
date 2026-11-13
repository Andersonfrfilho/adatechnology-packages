/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * T209 (RF8): o tipo do anexo é o dos **bytes**, nunca o declarado. Porta de
 * `conversation-attachment.policy.ts` (spec 183) — a regra pura, sem I/O. Vermelho até a T210
 * criar `attachmentType.ts`.
 */
import { describe, expect, it } from 'bun:test'

import { attachmentKindOf, matchesAttachmentSignature, normalizeAttachmentFileName } from './attachmentType'

describe('attachmentKindOf', () => {
  it('mapeia o content-type declarado para o tipo do vocabulário', () => {
    expect(attachmentKindOf('application/pdf')).toBe('document')
    expect(attachmentKindOf('image/png')).toBe('image')
    expect(attachmentKindOf('audio/ogg')).toBe('audio')
  })

  it('content-type fora da lista fechada não tem tipo', () => {
    expect(attachmentKindOf('image/svg+xml')).toBeUndefined()
    expect(attachmentKindOf('text/html')).toBeUndefined()
  })
})

describe('matchesAttachmentSignature (RF8: o tipo que vale é o dos bytes)', () => {
  it('PNG de verdade bate com a assinatura', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0])
    expect(matchesAttachmentSignature('image/png', png)).toBe(true)
  })

  it('PDF de verdade bate com a assinatura', () => {
    const pdf = new TextEncoder().encode('%PDF-1.4 resto do arquivo')
    expect(matchesAttachmentSignature('application/pdf', pdf)).toBe(true)
  })

  it('extensão/content-type mentindo (bytes de PNG declarados como PDF) é recusado', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0])
    expect(matchesAttachmentSignature('application/pdf', png)).toBe(false)
  })

  it('JPEG bate, WEBP não bate com bytes de JPEG', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0])
    expect(matchesAttachmentSignature('image/jpeg', jpeg)).toBe(true)
    expect(matchesAttachmentSignature('image/webp', jpeg)).toBe(false)
  })
})

describe('normalizeAttachmentFileName', () => {
  it('mantém só o último segmento do caminho, sem caractere de controle', () => {
    expect(normalizeAttachmentFileName('C:\\pasta\\arquivo.pdf')).toBe('arquivo.pdf')
    expect(normalizeAttachmentFileName('../../etc/passwd')).toBe('passwd')
  })

  it('nome vazio ou só pontos vira "anexo"', () => {
    expect(normalizeAttachmentFileName('')).toBe('anexo')
    expect(normalizeAttachmentFileName('.')).toBe('anexo')
    expect(normalizeAttachmentFileName('..')).toBe('anexo')
  })
})
