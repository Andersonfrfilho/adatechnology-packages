/**
 * Copyright (c) 2026 Ada Technology.
 * Licensed under the MIT License.
 */

import { describe, expect, test } from 'bun:test'

import { buildCteXml } from '../../src/sefaz/CteXmlBuilder'
import { buildMdfeXml } from '../../src/sefaz/MdfeXmlBuilder'
import { buildNfeXml } from '../../src/sefaz/NfeXmlBuilder'
import { buildChaveAcesso, isChaveDvValid } from '../../src/sefaz/SefazChave'
import {
  BASELINE_CNPJ,
  BASELINE_EMISSION_DATE,
  buildBaselineCteConfig,
  buildBaselineCteData,
  buildBaselineEmitParams,
  buildBaselineMdfeConfig,
  buildBaselineMdfeData,
  buildBaselineNfeConfig,
  buildBaselineNfeData,
  maskRandomCode,
} from '../fixtures/xml-numeric-baseline.fixture'
import {
  CTE_BASELINE_KEY_PREFIX,
  CTE_BASELINE_XML,
  MDFE_BASELINE_KEY_PREFIX,
  MDFE_BASELINE_XML,
  NFE_BASELINE_KEY_PREFIX,
  NFE_BASELINE_XML,
} from '../fixtures/xml-numeric-baseline.golden'

/**
 * Linha de base da spec 037 (CNPJ alfanumérico). Todo o acervo emitido até hoje tem CNPJ numérico;
 * a fase A reescreve o cálculo do DV e a normalização do CNPJ nos três builders. Este contrato
 * existe para provar que, para entrada numérica, o XML sai **byte a byte** igual ao de antes.
 *
 * Só `cNF`/`cCT`/`cMDF` (aleatórios por exigência do manual) e o DV que depende deles saem do
 * congelamento — as 35 primeiras posições da chave, onde o CNPJ mora, são literais.
 */

describe('linha de base — NF-e com CNPJ numérico', () => {
  const config = buildBaselineNfeConfig()
  const nfeData = buildBaselineNfeData()
  const chave = buildChaveAcesso({
    uf: config.uf,
    dataEmissao: BASELINE_EMISSION_DATE,
    cnpj: BASELINE_CNPJ,
    serie: config.serie,
    numeroNf: config.numeroNf,
    mod: '55',
  })

  test('a chave carrega o CNPJ íntegro nas posições 6..19', () => {
    expect(chave.chave).toHaveLength(44)
    expect(chave.chave.slice(0, 35)).toBe(NFE_BASELINE_KEY_PREFIX)
    expect(chave.chave.slice(6, 20)).toBe(BASELINE_CNPJ)
    expect(isChaveDvValid(chave.chave)).toBe(true)
  })

  test('o XML sai idêntico ao congelado', () => {
    const xml = buildNfeXml({
      params: buildBaselineEmitParams(config, nfeData),
      config,
      nfeData,
      chave,
      dataEmissao: BASELINE_EMISSION_DATE,
    })

    expect(maskRandomCode(xml, chave.chave)).toBe(NFE_BASELINE_XML)
  })
})

describe('linha de base — CT-e com CNPJ numérico', () => {
  test('a chave carrega o CNPJ íntegro nas posições 6..19', () => {
    const { chaveAcesso } = buildCteXml(buildBaselineCteConfig(), buildBaselineCteData(), BASELINE_EMISSION_DATE)

    expect(chaveAcesso).toHaveLength(44)
    expect(chaveAcesso.slice(0, 35)).toBe(CTE_BASELINE_KEY_PREFIX)
    expect(chaveAcesso.slice(6, 20)).toBe(BASELINE_CNPJ)
    expect(isChaveDvValid(chaveAcesso)).toBe(true)
  })

  test('o XML sai idêntico ao congelado', () => {
    const { xml, chaveAcesso } = buildCteXml(buildBaselineCteConfig(), buildBaselineCteData(), BASELINE_EMISSION_DATE)

    expect(maskRandomCode(xml, chaveAcesso)).toBe(CTE_BASELINE_XML)
  })
})

describe('linha de base — MDF-e com CNPJ numérico', () => {
  test('a chave carrega o CNPJ íntegro nas posições 6..19', () => {
    const { chaveAcesso } = buildMdfeXml(buildBaselineMdfeConfig(), buildBaselineMdfeData(), BASELINE_EMISSION_DATE)

    expect(chaveAcesso).toHaveLength(44)
    expect(chaveAcesso.slice(0, 35)).toBe(MDFE_BASELINE_KEY_PREFIX)
    expect(chaveAcesso.slice(6, 20)).toBe(BASELINE_CNPJ)
    expect(isChaveDvValid(chaveAcesso)).toBe(true)
  })

  test('o XML sai idêntico ao congelado', () => {
    const { xml, chaveAcesso } = buildMdfeXml(
      buildBaselineMdfeConfig(),
      buildBaselineMdfeData(),
      BASELINE_EMISSION_DATE,
    )

    expect(maskRandomCode(xml, chaveAcesso)).toBe(MDFE_BASELINE_XML)
  })
})

describe('estabilidade do congelamento', () => {
  test('duas execuções seguidas produzem o mesmo XML mascarado', () => {
    const first = buildCteXml(buildBaselineCteConfig(), buildBaselineCteData(), BASELINE_EMISSION_DATE)
    const second = buildCteXml(buildBaselineCteConfig(), buildBaselineCteData(), BASELINE_EMISSION_DATE)

    expect(first.chaveAcesso).not.toBe(second.chaveAcesso)
    expect(maskRandomCode(first.xml, first.chaveAcesso)).toBe(maskRandomCode(second.xml, second.chaveAcesso))
  })
})
