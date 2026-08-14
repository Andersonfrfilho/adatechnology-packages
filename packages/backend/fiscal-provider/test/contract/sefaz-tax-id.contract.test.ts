/**
 * Copyright (c) 2026 Ada Technology.
 * Licensed under the MIT License.
 */

import { describe, expect, test } from 'bun:test'

import {
  CHAVE_PATTERN,
  CNPJ_PATTERN,
  calcularDvChave,
  calcularDvCnpj,
  charValue,
  normalizeTaxId,
} from '../../src/sefaz/SefazTaxId'

/**
 * Fonte: NT Conjunta DF-e 2025.001 (itens 2, 4 e 5 + Anexos I e II), RFB "CNPJ Alfanumérico —
 * Perguntas & Respostas" (pergunta 14) e SERPRO "Cálculo dos dígitos verificadores de CNPJ
 * alfanumérico". Evidência em transportada/specs/037-cnpj-alfanumerico/evidence.md.
 */

/** Exemplo publicado pela RFB e pelo SERPRO, idêntico nos dois: 12.ABC.345/01DE-35. */
const EXEMPLO_OFICIAL = { base: '12ABC34501DE', dv: '35' } as const

const CNPJS_NUMERICOS_REAIS = ['11222333000181', '19131243000197', '00000000000191'] as const

describe('charValue', () => {
  test('dígito vale ele mesmo', () => {
    expect(charValue('0')).toBe(0)
    expect(charValue('9')).toBe(9)
  })

  test('letra vale ASCII menos 48', () => {
    expect(charValue('A')).toBe(17)
    expect(charValue('B')).toBe(18)
    expect(charValue('C')).toBe(19)
    expect(charValue('Z')).toBe(42)
  })
})

describe('normalizeTaxId', () => {
  test('remove a máscara normativa e o espaço', () => {
    expect(normalizeTaxId('12.ABC.345/01DE-35')).toBe('12ABC34501DE35')
    expect(normalizeTaxId(' 11.222.333/0001-81 ')).toBe('11222333000181')
  })

  test('sobe a caixa — sem isso o mesmo CNPJ vira duas empresas', () => {
    expect(normalizeTaxId('12abc34501de35')).toBe('12ABC34501DE35')
  })

  test('nunca remove letra: é isso que o replace(/\\D/g) fazia em silêncio', () => {
    expect(normalizeTaxId('12ABC34501DE35')).toBe('12ABC34501DE35')
    expect(normalizeTaxId('12ABC34501DE35')).toHaveLength(14)
  })

  test('deixa passar caractere não permitido para quem chama rejeitar', () => {
    expect(normalizeTaxId('12ABC#4501DE35')).toBe('12ABC#4501DE35')
    expect(CNPJ_PATTERN.test(normalizeTaxId('12ABC#4501DE35'))).toBe(false)
  })
})

describe('calcularDvCnpj', () => {
  test('exemplo oficial da RFB/SERPRO', () => {
    expect(calcularDvCnpj(EXEMPLO_OFICIAL.base)).toBe(EXEMPLO_OFICIAL.dv)
  })

  test.each(CNPJS_NUMERICOS_REAIS)('CNPJ numérico existente %s continua válido', (cnpj) => {
    expect(calcularDvCnpj(cnpj.slice(0, 12))).toBe(cnpj.slice(12))
  })

  test('recusa base fora do formato', () => {
    expect(() => calcularDvCnpj('12ABC34501D')).toThrow()
    expect(() => calcularDvCnpj('12abc34501de')).toThrow()
    expect(() => calcularDvCnpj('000000000000')).toThrow()
  })
})

describe('calcularDvChave', () => {
  /**
   * A norma não publica exemplo trabalhado de chave. O que se prova aqui é a compatibilidade
   * retroativa: para chave puramente numérica, o cálculo novo devolve o mesmo DV que o módulo 11
   * de sempre — pesos 2–9 da direita para a esquerda, resto < 2 vira zero.
   */
  const modulo11Classico = (digits: string): string => {
    const weights = [2, 3, 4, 5, 6, 7, 8, 9]
    let sum = 0
    let weightIndex = 0
    for (let index = digits.length - 1; index >= 0; index--) {
      sum += Number.parseInt(digits[index]!, 10) * weights[weightIndex % 8]!
      weightIndex++
    }
    const remainder = sum % 11
    return remainder < 2 ? '0' : String(11 - remainder)
  }

  const CHAVES_NUMERICAS = [
    '35190700000000000191550010000000011000000010',
    '31260712345678000195570010000000021000000029',
    '43170300232314000164550010000041711000041712',
  ] as const

  test.each(CHAVES_NUMERICAS)('chave numérica %s calcula como antes', (chave) => {
    expect(calcularDvChave(chave.slice(0, 43))).toBe(modulo11Classico(chave.slice(0, 43)))
  })

  test('chave com CNPJ alfanumérico produz DV numérico de uma posição', () => {
    const base43 = `352608${EXEMPLO_OFICIAL.base}${EXEMPLO_OFICIAL.dv}55001000000001115219142`
    expect(base43).toHaveLength(43)
    const dv = calcularDvChave(base43)
    expect(dv).toMatch(/^[0-9]$/u)
    expect(CHAVE_PATTERN.test(`${base43}${dv}`)).toBe(true)
  })

  test('recusa base fora de 43 posições', () => {
    expect(() => calcularDvChave('123')).toThrow()
  })
})

describe('CNPJ_PATTERN', () => {
  test('aceita numérico e alfanumérico', () => {
    expect(CNPJ_PATTERN.test('11222333000181')).toBe(true)
    expect(CNPJ_PATTERN.test('12ABC34501DE35')).toBe(true)
  })

  test('aceita as 26 letras — a exclusão de I/O/U/Q/F não é norma', () => {
    expect(CNPJ_PATTERN.test('IOUQF12345AB35')).toBe(true)
  })

  test('recusa minúscula, DV com letra e comprimento errado', () => {
    expect(CNPJ_PATTERN.test('12abc34501de35')).toBe(false)
    expect(CNPJ_PATTERN.test('12ABC34501DEA5')).toBe(false)
    expect(CNPJ_PATTERN.test('12ABC34501DE3')).toBe(false)
    expect(CNPJ_PATTERN.test('12ABC34501DE355')).toBe(false)
  })
})

describe('CHAVE_PATTERN', () => {
  test('aceita chave numérica e chave com CNPJ alfanumérico', () => {
    expect(CHAVE_PATTERN.test('35190700000000000191550010000000011000000010')).toBe(true)
    expect(CHAVE_PATTERN.test('35260812ABC34501DE35550010000000011152191428')).toBe(true)
  })

  test('recusa letra fora das 12 posições do CNPJ', () => {
    expect(CHAVE_PATTERN.test('3526A812ABC34501DE35550010000000011152191428')).toBe(false)
    expect(CHAVE_PATTERN.test('35260812ABC34501DE3555001000000001115219142A')).toBe(false)
  })

  test('recusa comprimento errado', () => {
    expect(CHAVE_PATTERN.test('3519070000000000019155001000000001100000001')).toBe(false)
  })
})
