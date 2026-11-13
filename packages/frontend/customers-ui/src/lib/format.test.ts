/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { applyMask, formatPhone, maskPhone } from './format'

describe('telefone', () => {
  it('devolve o número brasileiro legível a partir dos dígitos guardados', () => {
    expect(formatPhone('5516993056772')).toBe('+55 (16) 99305-6772')
    expect(formatPhone('1633056772')).toBe('(16) 3305-6772')
  })

  it('número que não casa com formato conhecido sai como veio — a tela não inventa moldura', () => {
    expect(formatPhone('447911123456')).toBe('447911123456')
  })

  it('mascarado, sobram os quatro últimos — o bastante para a pessoa se reconhecer', () => {
    const masked = maskPhone('5516993056772')

    expect(masked).toContain('6772')
    expect(masked).not.toContain('99305')
    expect(masked).toContain('•')
  })
})

describe('máscara declarativa', () => {
  it('aplica a máscara do catálogo, e não um switch por tipo de documento', () => {
    expect(applyMask('12345678901', '###.###.###-##')).toBe('123.456.789-01')
    expect(applyMask('12345678000199', '##.###.###/####-##')).toBe('12.345.678/0001-99')
  })

  it('sem máscara declarada, o valor sai cru', () => {
    expect(applyMask('ABC123')).toBe('ABC123')
  })

  it('valor MAIOR que a máscara sai cru — truncar em silêncio esconderia dado do operador', () => {
    expect(applyMask('123456789012345', '###.###.###-##')).toBe('123456789012345')
  })

  it('valor menor preenche só o que dá, sem separador pendurado no fim', () => {
    expect(applyMask('123', '###.###.###-##')).toBe('123')
  })
})
