/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, test } from 'bun:test'

import { filterSelectOptions, findByPrefix, normalizeForSearch } from './selectFilter.util'

const OPTIONS = [
  { value: '1', label: 'Salão Térreo' },
  { value: '2', label: 'Sala de Reunião' },
  { value: '3', label: 'Consultório 2' },
  { value: '4', label: 'América/São Paulo' },
] as const

describe('normalizeForSearch', () => {
  test('tira acento, caixa e espaço das pontas', () => {
    expect(normalizeForSearch('  Salão TÉRREO ')).toBe('salao terreo')
  })
})

describe('filterSelectOptions', () => {
  test('acha o acentuado a partir do texto sem acento', () => {
    expect(filterSelectOptions(OPTIONS, 'salao terreo').map((o) => o.value)).toEqual(['1'])
  })

  test('casa no meio do rótulo, não só no começo', () => {
    expect(filterSelectOptions(OPTIONS, 'reuniao').map((o) => o.value)).toEqual(['2'])
  })

  test('busca vazia ou só espaço devolve a lista inteira', () => {
    expect(filterSelectOptions(OPTIONS, '')).toHaveLength(OPTIONS.length)
    expect(filterSelectOptions(OPTIONS, '   ')).toHaveLength(OPTIONS.length)
  })

  test('sem correspondência devolve lista vazia, e não a lista toda', () => {
    expect(filterSelectOptions(OPTIONS, 'garagem')).toEqual([])
  })
})

describe('findByPrefix', () => {
  test('salta para o primeiro que começa com o texto', () => {
    expect(findByPrefix(OPTIONS, 'sala')).toBe(0)
  })

  test('não casa no meio — prefixo é prefixo', () => {
    expect(findByPrefix(OPTIONS, 'terreo')).toBe(-1)
  })

  test('devolve -1 para texto vazio, senão digitar espaço saltaria para o primeiro item', () => {
    expect(findByPrefix(OPTIONS, '')).toBe(-1)
  })
})
