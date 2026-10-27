/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { collapseRepetitions } from './collapse-repetitions.util'

describe('collapseRepetitions', () => {
  it('colapsa o loop de frase única que o Whisper produz em trecho ruidoso', () => {
    const looped = `bom dia. ${'de coletivo, '.repeat(90)}quero dois pães.`

    expect(collapseRepetitions(looped)).toBe('bom dia. de coletivo, quero dois pães.')
  })

  it('colapsa ciclo de vários segmentos no menor ciclo, não em um múltiplo dele', () => {
    const looped = 'a, b, a, b, a, b, fim.'

    expect(collapseRepetitions(looped)).toBe('a, b, fim.')
  })

  it('preserva ênfase legítima de duas repetições', () => {
    expect(collapseRepetitions('não, não, pode deixar.')).toBe('não, não, pode deixar.')
  })

  it('compara ignorando caixa e pontuação, para o loop que varia a vírgula', () => {
    expect(collapseRepetitions('Nós vamos lá. nós vamos lá, nós vamos lá! acabou.')).toBe('Nós vamos lá. acabou.')
  })

  it('não altera texto sem repetição e devolve com trim', () => {
    expect(collapseRepetitions('  quero agendar para quinta-feira de manhã.  ')).toBe(
      'quero agendar para quinta-feira de manhã.',
    )
  })

  it('aceita texto vazio', () => {
    expect(collapseRepetitions('')).toBe('')
  })
})
