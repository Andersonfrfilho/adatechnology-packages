/**
 * Copyright (c) 2026 Ada Technology.
 * Licensed under the MIT License.
 */

import { describe, expect, test } from 'bun:test'

import { buildChaveAcesso, isChaveDvValid } from '../../src/sefaz/SefazChave'
import { CHAVE_PATTERN } from '../../src/sefaz/SefazTaxId'

/**
 * Chave de acesso com CNPJ alfanumérico (NT Conjunta DF-e 2025.001, item 5). Antes da spec 037
 * este CNPJ produzia `35260800000123450135550010000000011521914221` — o `replace(/\D/g, '')`
 * derrubava `ABC` e `DE`, e o `padStart(14, '0')` recompunha o buraco com zero à esquerda. A chave
 * saía com 44 posições e sintaxe perfeita, apontando para outro contribuinte.
 */

const CNPJ_ALFANUMERICO = '12ABC34501DE35'
const EMISSION_DATE = new Date('2026-08-14T18:30:00.000Z')

function buildAlphanumericKey(): string {
  return buildChaveAcesso({
    uf: 'SP',
    dataEmissao: EMISSION_DATE,
    cnpj: CNPJ_ALFANUMERICO,
    serie: '1',
    numeroNf: 1,
    mod: '55',
  }).chave
}

describe('buildChaveAcesso com CNPJ alfanumérico', () => {
  test('grava o CNPJ íntegro nas posições 6..19', () => {
    const chave = buildAlphanumericKey()

    expect(chave).toHaveLength(44)
    expect(chave.slice(6, 20)).toBe(CNPJ_ALFANUMERICO)
    expect(CHAVE_PATTERN.test(chave)).toBe(true)
  })

  test('não fabrica zero à esquerda no lugar da letra', () => {
    expect(buildAlphanumericKey()).not.toContain('00000123450135')
  })

  test('a máscara do CNPJ não muda a chave', () => {
    const masked = buildChaveAcesso({
      uf: 'SP',
      dataEmissao: EMISSION_DATE,
      cnpj: '12.ABC.345/01DE-35',
      serie: '1',
      numeroNf: 1,
      mod: '55',
    }).chave

    expect(masked.slice(0, 35)).toBe(buildAlphanumericKey().slice(0, 35))
  })

  test('recusa CNPJ que não fecha 14 posições em vez de completar com zero', () => {
    expect(() =>
      buildChaveAcesso({
        uf: 'SP',
        dataEmissao: EMISSION_DATE,
        cnpj: '12ABC345',
        serie: '1',
        numeroNf: 1,
        mod: '55',
      }),
    ).toThrow()
  })
})

describe('isChaveDvValid com CNPJ alfanumérico', () => {
  test('aceita a chave que o próprio provider acabou de gerar', () => {
    expect(isChaveDvValid(buildAlphanumericKey())).toBe(true)
  })

  test('rejeita a mesma chave com o DV trocado', () => {
    const chave = buildAlphanumericKey()
    const wrongDigit = String((Number.parseInt(chave.slice(43), 10) + 1) % 10)

    expect(isChaveDvValid(`${chave.slice(0, 43)}${wrongDigit}`)).toBe(false)
  })

  test('continua rejeitando comprimento errado', () => {
    expect(isChaveDvValid(buildAlphanumericKey().slice(0, 43))).toBe(false)
  })
})
