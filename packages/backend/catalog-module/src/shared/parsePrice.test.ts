/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { parsePriceToCents } from './parsePrice'

function cents(raw: string | number): number | string {
  const result = parsePriceToCents(raw, 'pt-BR')
  return result.ok ? result.cents : `ERRO: ${result.reason}`
}

describe('parsePriceToCents', () => {
  it('lê o formato brasileiro de planilha', () => {
    expect(cents('19,90')).toBe(1990)
    expect(cents('0,50')).toBe(50)
    expect(cents('1299,00')).toBe(129900)
  })

  it('lê o formato americano, que sai de CSV exportado em en-US', () => {
    expect(cents('19.90')).toBe(1990)
    expect(cents('0.05')).toBe(5)
  })

  it('ignora símbolo de moeda e espaço colados pelo operador', () => {
    expect(cents('R$ 19,90')).toBe(1990)
    expect(cents(' 19,90 ')).toBe(1990)
  })

  it('trata separador de milhar sem confundir com decimal', () => {
    // O último separador só é decimal quando sobram 1 ou 2 dígitos depois dele.
    expect(cents('1.299,90')).toBe(129990)
    expect(cents('1,299.90')).toBe(129990)
    // Três dígitos depois do ponto = milhar, não decimal. `1.299` é mil e duzentos e noventa e
    // nove, e lê-lo como 1,299 dividiria o preço por mil.
    expect(cents('1.299')).toBe(129900)
  })

  it('aceita número já numérico', () => {
    expect(cents(19.9)).toBe(1990)
    expect(cents(0)).toBe(0)
  })

  it('arredonda centavo fracionário em vez de truncar', () => {
    // 19.999 * 100 = 1999.9999... — truncar daria 1999 e perderia um centavo por item.
    expect(cents(19.999)).toBe(2000)
  })

  it('recusa o que não é preço', () => {
    expect(String(cents(''))).toContain('ERRO')
    expect(String(cents('grátis'))).toContain('ERRO')
    expect(String(cents('-5,00'))).toContain('ERRO')
    expect(String(cents(Number.NaN))).toContain('ERRO')
  })

  it('recusa valor acima do teto de sanidade', () => {
    expect(String(cents('9999999999,00'))).toContain('ERRO')
  })
})
