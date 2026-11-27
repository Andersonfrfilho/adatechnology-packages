/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { readPreviewScroll, writePreviewScroll } from './scrollMemory'

describe('rolagem guardada', () => {
  it('lembra por chave e devolve 0 para chave nova', () => {
    expect(readPreviewScroll('nunca-vista')).toBe(0)
    writePreviewScroll('tela-a', 1234)
    writePreviewScroll('tela-b', 20)
    expect(readPreviewScroll('tela-a')).toBe(1234)
    expect(readPreviewScroll('tela-b')).toBe(20)
  })
})
