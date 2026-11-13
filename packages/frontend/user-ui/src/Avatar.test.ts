/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { initialsOf } from './Avatar'

describe('initialsOf', () => {
  it('usa o primeiro e o ultimo nome, ignorando as particulas do meio', () => {
    expect(initialsOf('Maria da Silva Souza')).toBe('MS')
    expect(initialsOf('Anderson Fernandes')).toBe('AF')
  })

  it('nome unico rende uma letra so, e nao uma letra repetida', () => {
    expect(initialsOf('Anderson')).toBe('A')
  })

  it('nao quebra com espaco sobrando nem com nome vazio', () => {
    expect(initialsOf('  Ana   Paula  ')).toBe('AP')
    expect(initialsOf('   ')).toBe('?')
  })
})
