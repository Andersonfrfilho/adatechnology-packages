/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { AVATAR_MAX_BYTES, AVATAR_REJECTION, checkAvatar } from './avatar'

describe('checkAvatar', () => {
  it('aceita os tres tipos servidos como imagem inerte', () => {
    for (const contentType of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(checkAvatar({ contentType, byteLength: 1024 })).toBeUndefined()
    }
  })

  it('recusa SVG, que carrega script e viraria XSS no nosso dominio', () => {
    expect(checkAvatar({ contentType: 'image/svg+xml', byteLength: 1024 })).toBe(AVATAR_REJECTION.UNSUPPORTED_TYPE)
  })

  it('separa grande demais de tipo errado, porque a correcao e outra', () => {
    expect(checkAvatar({ contentType: 'image/png', byteLength: AVATAR_MAX_BYTES + 1 })).toBe(AVATAR_REJECTION.TOO_LARGE)
    expect(checkAvatar({ contentType: 'image/png', byteLength: 0 })).toBe(AVATAR_REJECTION.EMPTY)
  })

  it('checa o tamanho antes do tipo: nao adianta aprovar o tipo de um arquivo que sera recusado', () => {
    expect(checkAvatar({ contentType: 'image/gif', byteLength: AVATAR_MAX_BYTES + 1 })).toBe(AVATAR_REJECTION.TOO_LARGE)
  })
})
