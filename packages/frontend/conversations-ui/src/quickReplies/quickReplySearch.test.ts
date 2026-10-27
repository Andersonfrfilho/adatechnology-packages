import { describe, expect, it } from 'bun:test'

import { filterQuickReplies, highlightMatch, normalizeForSearch } from './quickReplySearch'
import type { QuickReply } from './quickReply.types'

const GREETING: QuickReply = { id: '1', title: 'Saudação', shortcut: 'ola', body: 'Olá {{nome}}, tudo bem?' }
const DOCS: QuickReply = { id: '2', title: 'Pedido de documento', shortcut: 'doc', body: 'Envie seu RG e CPF.' }

describe('normalizeForSearch', () => {
  it('remove acento e ignora caixa', () => {
    expect(normalizeForSearch('Saudação')).toBe('saudacao')
    expect(normalizeForSearch('VOCÊ')).toBe('voce')
  })
})

describe('filterQuickReplies', () => {
  it('busca sem acento no título', () => {
    const result = filterQuickReplies({ quickReplies: [GREETING, DOCS], search: 'saudacao' })
    expect(result).toEqual([GREETING])
  })

  it('busca no atalho', () => {
    const result = filterQuickReplies({ quickReplies: [GREETING, DOCS], search: 'doc' })
    expect(result).toEqual([DOCS])
  })

  it('busca no corpo já com a variável trocada', () => {
    const result = filterQuickReplies({ quickReplies: [GREETING], search: 'marina', variables: { nome: 'Marina' } })
    expect(result).toEqual([GREETING])
  })

  it('termo vazio devolve tudo', () => {
    expect(filterQuickReplies({ quickReplies: [GREETING, DOCS], search: '  ' })).toEqual([GREETING, DOCS])
  })

  it('sem correspondência devolve lista vazia', () => {
    expect(filterQuickReplies({ quickReplies: [GREETING, DOCS], search: 'boleto' })).toEqual([])
  })

  it('termo só de marca combinante normaliza para vazio e não filtra nada', () => {
    // "́" sozinho (acento agudo combinante, sem base) normaliza para string vazia.
    expect(filterQuickReplies({ quickReplies: [GREETING, DOCS], search: '́' })).toEqual([GREETING, DOCS])
  })
})

describe('highlightMatch', () => {
  it('destaca o trecho encontrado preservando o texto original', () => {
    const segments = highlightMatch('Pedido de documento', 'documento')
    expect(segments).toEqual([
      { text: 'Pedido de ', isMatch: false },
      { text: 'documento', isMatch: true },
    ])
  })

  it('casa mesmo com acento diferente entre busca e texto', () => {
    const segments = highlightMatch('Saudação', 'saudacao')
    expect(segments.some((segment) => segment.isMatch)).toBe(true)
    expect(segments.map((segment) => segment.text).join('')).toBe('Saudação')
  })

  it('sem termo, devolve o texto inteiro sem destaque', () => {
    expect(highlightMatch('Saudação', '')).toEqual([{ text: 'Saudação', isMatch: false }])
  })

  it('sem correspondência, devolve um único segmento sem destaque', () => {
    expect(highlightMatch('Saudação', 'boleto')).toEqual([{ text: 'Saudação', isMatch: false }])
  })

  it('casa e recorta certo quando o texto vem em NFD (acento como combinante separado)', () => {
    const nfdText = 'José'.normalize('NFD') // "José" com o acento como caractere combinante
    const segments = highlightMatch(nfdText, 'jose')
    expect(segments.map((segment) => segment.text).join('')).toBe(nfdText)
    expect(segments.some((segment) => segment.isMatch)).toBe(true)
  })

  it('casa e recorta certo quando minúscula tem mais caracteres que a maiúscula (İ)', () => {
    const text = 'İstanbul'
    const segments = highlightMatch(text, 'istanbul')
    expect(segments.map((segment) => segment.text).join('')).toBe(text)
    expect(segments.some((segment) => segment.isMatch)).toBe(true)
  })

  it('termo só de marca combinante normaliza para vazio — não trava em loop e devolve o texto inteiro', () => {
    // Sem o guard, `indexOf('')` sempre acha posição 0 e o cursor nunca avança: loop infinito.
    const segments = highlightMatch('Saudação', '́')
    expect(segments).toEqual([{ text: 'Saudação', isMatch: false }])
  })
})
