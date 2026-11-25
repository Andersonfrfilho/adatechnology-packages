/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import {
  interpolateFlowText,
  listFlowPlaceholders,
  matchFlowChoice,
  matchFlowKeywordRoute,
  matchesFlowKeyword,
  normalizeFlowText,
} from './flowText'

const OPTIONS: [string, string][] = [
  ['book', '📅 Agendar visita'],
  ['prices', '💲 Ver preços'],
  ['human', '🙋 Falar com pessoa'],
]

describe('normalizeFlowText', () => {
  it('drops accents, emoji, punctuation and case', () => {
    expect(normalizeFlowText('  🛒 Ver PREÇOS!! ')).toBe('ver precos')
  })
})

describe('matchesFlowKeyword', () => {
  it('matches regardless of accent and case', () => {
    expect(matchesFlowKeyword('Menú', ['menu'])).toBe(true)
    expect(matchesFlowKeyword('menu principal', ['menu'])).toBe(false)
  })
})

describe('matchFlowKeywordRoute', () => {
  it('finds a keyword inside a sentence and prefers the longest one', () => {
    const routes = { horario: 'hours', 'horario sabado': 'saturday' }
    expect(matchFlowKeywordRoute('Qual o horário de vocês?', routes)).toBe('hours')
    expect(matchFlowKeywordRoute('e o horario sabado?', routes)).toBe('saturday')
    expect(matchFlowKeywordRoute('bom dia', routes)).toBeUndefined()
  })

  it('does not match a keyword that is only part of a word', () => {
    expect(matchFlowKeywordRoute('precosinho', { preco: 'prices' })).toBeUndefined()
  })
})

describe('matchFlowChoice', () => {
  it('accepts the option number, label, id and significant words', () => {
    expect(matchFlowChoice('2', OPTIONS)).toBe('prices')
    expect(matchFlowChoice('ver precos', OPTIONS)).toBe('prices')
    expect(matchFlowChoice('book', OPTIONS)).toBe('book')
    expect(matchFlowChoice('quero agendar uma visita', OPTIONS)).toBe('book')
  })

  it('returns undefined on no match or ambiguity', () => {
    expect(matchFlowChoice('9', OPTIONS)).toBeUndefined()
    expect(matchFlowChoice('tchau', OPTIONS)).toBeUndefined()
  })
})

describe('interpolateFlowText', () => {
  it('replaces keys, nested keys and formats ISO dates', () => {
    const text = interpolateFlowText('Oi {{contactFirstName}}, dia {{booking.date}} para {{people}}.', {
      contactFirstName: 'Ana',
      booking: { date: '2026-12-24' },
      people: 4,
    })
    expect(text).toBe('Oi Ana, dia 24/12/2026 para 4.')
  })

  it('renders missing keys as empty text and honours formatValue', () => {
    expect(interpolateFlowText('[{{missing}}]', {})).toBe('[]')
    expect(interpolateFlowText('{{total}}', { total: 10 }, { formatValue: ({ value }) => `R$ ${String(value)}` })).toBe(
      'R$ 10',
    )
  })

  it('lists placeholders', () => {
    expect(listFlowPlaceholders('{{a}} e {{ b.c }}')).toEqual(['a', 'b.c'])
  })
})
