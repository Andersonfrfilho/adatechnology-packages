/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { searchEmoji } from './emoji'
import { insertImage, insertLink, insertText, isAbsoluteUrl, toggleLinePrefix, toggleWrap } from './markdownFormat'

const at = (value: string, start: number, end = start) => ({ value, start, end })

describe('toggleWrap', () => {
  it('envolve a seleção em negrito e mantém o texto selecionado', () => {
    expect(toggleWrap(at('olá mundo', 4, 9), '**', 'texto')).toEqual(at('olá **mundo**', 6, 11))
  })

  it('desfaz quando a seleção já está envolvida', () => {
    expect(toggleWrap(at('olá **mundo**', 6, 11), '**', 'texto')).toEqual(at('olá mundo', 4, 9))
    expect(toggleWrap(at('**mundo**', 0, 9), '**', 'texto')).toEqual(at('mundo', 0, 5))
  })

  it('sem seleção insere o texto de exemplo já selecionado', () => {
    expect(toggleWrap(at('', 0), '*', 'texto')).toEqual(at('*texto*', 1, 6))
  })
})

describe('toggleLinePrefix', () => {
  it('título troca o prefixo de bloco existente', () => {
    expect(toggleLinePrefix(at('- item', 2), 'heading2', 'texto').value).toBe('## item')
  })

  it('liga e desliga o mesmo prefixo', () => {
    const on = toggleLinePrefix(at('item', 0, 4), 'quote', 'texto')
    expect(on.value).toBe('> item')
    expect(toggleLinePrefix(at(on.value, 0, on.value.length), 'quote', 'texto').value).toBe('item')
  })

  it('lista numerada numera cada linha selecionada, só as linhas tocadas', () => {
    const result = toggleLinePrefix(at('antes\na\nb\ndepois', 6, 9), 'numberedList', 'texto')
    expect(result.value).toBe('antes\n1. a\n2. b\ndepois')
  })

  it('linha vazia ganha o texto de exemplo', () => {
    expect(toggleLinePrefix(at('', 0), 'bulletList', 'texto').value).toBe('- texto')
  })
})

describe('inserções', () => {
  it('link usa o texto da seleção quando o campo vem vazio', () => {
    const result = insertLink(at('veja aqui', 5, 9), { url: 'https://a.com', text: '' })
    expect(result.value).toBe('veja [aqui](https://a.com)')
    expect(result.start).toBe(result.value.length)
  })

  it('imagem escreve ![alt](url) sem colchetes no alt', () => {
    expect(insertImage(at('', 0), { url: 'https://a.com/x.png', alt: 'foto [1]' }).value).toBe(
      '![foto 1](https://a.com/x.png)',
    )
  })

  it('emoji entra no cursor', () => {
    expect(insertText(at('oi ', 3), '🎉')).toEqual(at('oi 🎉', 5))
  })

  it('só aceita http(s) absoluto', () => {
    expect(isAbsoluteUrl('https://a.com')).toBe(true)
    expect(isAbsoluteUrl('javascript:alert(1)')).toBe(false)
    expect(isAbsoluteUrl('a.com')).toBe(false)
  })
})

describe('searchEmoji', () => {
  it('casa por nome em pt-BR ou en e devolve vazio sem consulta', () => {
    expect(searchEmoji('festa').some((entry) => entry.char === '🎉')).toBe(true)
    expect(searchEmoji('party').some((entry) => entry.char === '🎉')).toBe(true)
    expect(searchEmoji('  ')).toEqual([])
  })
})
