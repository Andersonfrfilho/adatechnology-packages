import { describe, expect, it } from 'bun:test'
import { mediaTypeOf } from './ConversationPreview'

describe('mediaTypeOf', () => {
  it('deriva imagem, vídeo e áudio pelo prefixo do MIME', () => {
    expect(mediaTypeOf('image/jpeg')).toBe('image')
    expect(mediaTypeOf('video/mp4')).toBe('video')
    expect(mediaTypeOf('audio/webm')).toBe('audio')
  })

  it('trata o resto como documento, inclusive MIME desconhecido', () => {
    expect(mediaTypeOf('application/pdf')).toBe('document')
    expect(mediaTypeOf('')).toBe('document')
  })
})
