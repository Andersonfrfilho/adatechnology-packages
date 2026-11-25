/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { isValidSlug, slugify, SLUG_MAX_LENGTH, withSlugSuffix } from './slugify'
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
