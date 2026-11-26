/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import {
  buildShortSlug,
  DEFAULT_SHORT_SLUG_LENGTH,
  isValidSlug,
  slugify,
  SLUG_MAX_LENGTH,
  withSlugSuffix,
} from './slugify'
import { normalizeTags } from './tags'
import { buildExcerpt, estimateReadingTimeMinutes } from './readingTime'

describe('slugify', () => {
  it('remove acento, pontuação e caixa', () => {
    expect(slugify('Promoção de Verão!')).toBe('promocao-de-verao')
    expect(slugify('  Ação & Reação — 2026  ')).toBe('acao-reacao-2026')
    expect(slugify('Ñandú über café')).toBe('nandu-uber-cafe')
  })

  it('devolve vazio quando não sobra caractere latino', () => {
    expect(slugify('🎉🎉')).toBe('')
  })

  it('respeita o teto cortando em fronteira de palavra', () => {
    const slug = slugify('palavra '.repeat(40))
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH)
    expect(slug.endsWith('-')).toBe(false)
    expect(slug.endsWith('palavra')).toBe(true)
  })

  it('valida slug', () => {
    expect(isValidSlug('meu-post-1')).toBe(true)
    expect(isValidSlug('Meu-Post')).toBe(false)
    expect(isValidSlug('a--b')).toBe(false)
    expect(isValidSlug('-a')).toBe(false)
    expect(isValidSlug('')).toBe(false)
  })

  it('acrescenta sufixo sem passar do teto', () => {
    expect(withSlugSuffix('post', 1)).toBe('post')
    expect(withSlugSuffix('post', 3)).toBe('post-3')
    expect(withSlugSuffix('a'.repeat(SLUG_MAX_LENGTH), 12).length).toBe(SLUG_MAX_LENGTH)
  })
})

describe('tags', () => {
  it('normaliza, remove repetidas e vazias', () => {
    expect(normalizeTags([' Novidades ', 'novidades', '', 'Dicas  de   uso'])).toEqual(['novidades', 'dicas de uso'])
  })
})

describe('tempo de leitura e resumo', () => {
  it('conta ao menos 1 minuto', () => {
    expect(estimateReadingTimeMinutes('')).toBe(1)
    expect(estimateReadingTimeMinutes('palavra '.repeat(401))).toBe(3)
  })

  it('ignora a marcação ao contar', () => {
    expect(estimateReadingTimeMinutes('**a** [b](https://x.com)', 1)).toBe(2)
  })

  it('resumo corta em fronteira de palavra', () => {
    expect(buildExcerpt('# Título\n\nUm texto **curto**.')).toBe('Título Um texto curto.')
    const excerpt = buildExcerpt('palavra '.repeat(100), 50)
    expect(excerpt.length).toBeLessThanOrEqual(50)
    expect(excerpt.endsWith('palavra…')).toBe(true)
  })
})

describe('buildShortSlug', () => {
  it('tira acento e palavras de ligação do pt-BR', () => {
    expect(buildShortSlug('Novidades de fim de ano: cardápio para as festas')).toBe('novidades-fim-ano-cardapio-festas')
  })

  it('corta na fronteira de palavra dentro do limite', () => {
    const slug = buildShortSlug('palavra comprida '.repeat(20))
    expect(slug.length).toBeLessThanOrEqual(DEFAULT_SHORT_SLUG_LENGTH)
    expect(slug.endsWith('-')).toBe(false)
    expect(slug.split('-').every((word) => word === 'palavra' || word === 'comprida')).toBe(true)
  })

  it('só palavras de ligação mantém as palavras; opções trocam limite e lista', () => {
    expect(buildShortSlug('E o da')).toBe('e-o-da')
    expect(buildShortSlug('de volta para o futuro', { stopWords: false })).toBe('de-volta-para-o-futuro')
    expect(buildShortSlug('um dois tres quatro', { maxLength: 10 })).toBe('dois-tres')
    expect(buildShortSlug('🎉')).toBe('')
  })

  it('palavra única maior que o limite é cortada', () => {
    expect(buildShortSlug('x'.repeat(100), { maxLength: 20 })).toBe('x'.repeat(20))
  })
})
