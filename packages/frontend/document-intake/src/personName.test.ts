/* Copyright (c) 2026 Ada Technology. MIT License. */
import { describe, expect, test } from 'bun:test'

import { normalizePersonName } from './personName.service'

describe('normalizePersonName', () => {
  test('trims, collapses spaces and title-cases', () => {
    expect(normalizePersonName('  ana   maria  souza ')).toBe('Ana Maria Souza')
    expect(normalizePersonName('JOSÉ DA SILVA')).toBe('José da Silva')
  })

  test('keeps da/de/do/das/dos/e lower-case except as the first word', () => {
    expect(normalizePersonName('maria das dores e silva dos santos')).toBe('Maria das Dores e Silva dos Santos')
    expect(normalizePersonName('de souza')).toBe('De Souza')
    expect(normalizePersonName('joão do carmo de oliveira')).toBe('João do Carmo de Oliveira')
  })

  test('handles apostrophes and hyphens', () => {
    expect(normalizePersonName("carlos d'ávila")).toBe("Carlos D'Ávila")
    expect(normalizePersonName('MARIA O’CONNOR')).toBe('Maria O’Connor')
    expect(normalizePersonName('ana-maria da luz')).toBe('Ana-Maria da Luz')
  })

  test('accented capitals and empty input', () => {
    expect(normalizePersonName('érica ÁVILA')).toBe('Érica Ávila')
    expect(normalizePersonName('   ')).toBe('')
  })
})
