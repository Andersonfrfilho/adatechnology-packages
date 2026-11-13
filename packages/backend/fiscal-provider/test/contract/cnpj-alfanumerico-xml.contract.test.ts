/**
 * Copyright (c) 2026 Ada Technology.
 * Licensed under the MIT License.
 */

import { describe, expect, test } from 'bun:test'

import { buildCteXml } from '../../src/sefaz/CteXmlBuilder'
import { buildMdfeXml } from '../../src/sefaz/MdfeXmlBuilder'
import { buildNfeXml } from '../../src/sefaz/NfeXmlBuilder'
import { buildNfceXml } from '../../src/sefaz/SefazXmlBuilder'
import { buildChaveAcesso, isChaveDvValid } from '../../src/sefaz/SefazChave'
import { isCnpjValid } from '../../src/sefaz/SefazTaxId'
import * as packageSurface from '../../src/index'
import type { NfceConfig } from '../../src/types'
import {
  BASELINE_EMISSION_DATE,
  buildBaselineCteConfig,
  buildBaselineCteData,
  buildBaselineEmitParams,
  buildBaselineMdfeConfig,
  buildBaselineMdfeData,
  buildBaselineNfeConfig,
  buildBaselineNfeData,
} from '../fixtures/xml-numeric-baseline.fixture'

/**
 * O mesmo CNPJ alfanumérico atravessando os quatro builders de XML. A linha de base numérica
 * (`xml-numeric-baseline.contract.test.ts`) prova que o acervo antigo não mudou; este contrato prova
 * que o acervo novo sai correto. Antes da spec 037 as letras eram descartadas pelo
 * `replace(/\D/g, '')` e o documento saía apontando para outro contribuinte, sem erro nenhum.
 */

const EMITENTE_CNPJ = '12ABC34501DE35'
const DESTINATARIO_CNPJ = '45XY6789ZW0165'

/** O que o defeito produzia: as letras somem e o resto escorrega para a esquerda. */
const CORRUPTED_EMITENTE = '1234501' + '35'

describe('os dois CNPJs do caso são válidos pela regra da RFB', () => {
  test('o DV fecha com a tabela alfanumérica', () => {
    expect(isCnpjValid(EMITENTE_CNPJ)).toBe(true)
    expect(isCnpjValid(DESTINATARIO_CNPJ)).toBe(true)
  })
})

describe('NF-e com CNPJ alfanumérico', () => {
  const config = { ...buildBaselineNfeConfig(), cnpj: EMITENTE_CNPJ }
  const nfeData = {
    ...buildBaselineNfeData(),
    destinatario: { ...buildBaselineNfeData().destinatario, cnpj: DESTINATARIO_CNPJ },
  }
  const chave = buildChaveAcesso({
    uf: config.uf,
    dataEmissao: BASELINE_EMISSION_DATE,
    cnpj: EMITENTE_CNPJ,
    serie: config.serie,
    numeroNf: config.numeroNf,
    mod: '55',
  })

  test('emitente e destinatário saem íntegros no XML', () => {
    const xml = buildNfeXml({
      params: buildBaselineEmitParams(config, nfeData),
      config,
      nfeData,
      chave,
      dataEmissao: BASELINE_EMISSION_DATE,
    })

    expect(xml).toContain(`<CNPJ>${EMITENTE_CNPJ}</CNPJ>`)
    expect(xml).toContain(`<CNPJ>${DESTINATARIO_CNPJ}</CNPJ>`)
    expect(xml).not.toContain(CORRUPTED_EMITENTE)
    expect(xml).toContain(chave.chave)
  })

  test('a chave leva o CNPJ do emitente e o DV fecha', () => {
    expect(chave.chave.slice(6, 20)).toBe(EMITENTE_CNPJ)
    expect(isChaveDvValid(chave.chave)).toBe(true)
  })
})

describe('NFC-e com CNPJ alfanumérico', () => {
  test('o emitente sai íntegro no XML', () => {
    const nfeConfig = buildBaselineNfeConfig()
    const config: NfceConfig = {
      ...nfeConfig,
      model: 'nfce',
      cnpj: EMITENTE_CNPJ,
      cscToken: 'unused',
      cscId: '000001',
    }
    const chave = buildChaveAcesso({
      uf: config.uf,
      dataEmissao: BASELINE_EMISSION_DATE,
      cnpj: EMITENTE_CNPJ,
      serie: config.serie,
      numeroNf: 1,
      mod: '65',
    })
    const params = buildBaselineEmitParams(nfeConfig, buildBaselineNfeData())

    const xml = buildNfceXml({ params, config, chave, dataEmissao: BASELINE_EMISSION_DATE })

    expect(xml).toContain(`<CNPJ>${EMITENTE_CNPJ}</CNPJ>`)
    expect(xml).not.toContain(CORRUPTED_EMITENTE)
    expect(chave.chave.slice(6, 20)).toBe(EMITENTE_CNPJ)
  })
})

describe('CT-e com CNPJ alfanumérico', () => {
  test('emitente, remetente e destinatário saem íntegros', () => {
    const config = { ...buildBaselineCteConfig(), cnpj: EMITENTE_CNPJ }
    const cteData = buildBaselineCteData()
    const data = {
      ...cteData,
      remetente: { ...cteData.remetente, cnpj: EMITENTE_CNPJ },
      destinatario: { ...cteData.destinatario, cnpj: DESTINATARIO_CNPJ },
    }

    const { xml, chaveAcesso } = buildCteXml(config, data, BASELINE_EMISSION_DATE)

    expect(xml).toContain(`<CNPJ>${EMITENTE_CNPJ}</CNPJ>`)
    expect(xml).toContain(`<CNPJ>${DESTINATARIO_CNPJ}</CNPJ>`)
    expect(xml).not.toContain(CORRUPTED_EMITENTE)
    expect(chaveAcesso.slice(6, 20)).toBe(EMITENTE_CNPJ)
    expect(isChaveDvValid(chaveAcesso)).toBe(true)
  })
})

describe('MDF-e com CNPJ alfanumérico', () => {
  test('o emitente sai íntegro e a chave fecha o DV', () => {
    const config = { ...buildBaselineMdfeConfig(), cnpj: EMITENTE_CNPJ }

    const { xml, chaveAcesso } = buildMdfeXml(config, buildBaselineMdfeData(), BASELINE_EMISSION_DATE)

    expect(xml).toContain(`<CNPJ>${EMITENTE_CNPJ}</CNPJ>`)
    expect(xml).not.toContain(CORRUPTED_EMITENTE)
    expect(chaveAcesso.slice(6, 20)).toBe(EMITENTE_CNPJ)
    expect(isChaveDvValid(chaveAcesso)).toBe(true)
  })
})

describe('a máscara do cadastro não vaza para o XML', () => {
  test('CNPJ digitado com pontuação sai limpo', () => {
    const config = { ...buildBaselineMdfeConfig(), cnpj: '12.ABC.345/01DE-35' }

    const { xml } = buildMdfeXml(config, buildBaselineMdfeData(), BASELINE_EMISSION_DATE)

    expect(xml).toContain(`<CNPJ>${EMITENTE_CNPJ}</CNPJ>`)
    expect(xml).not.toContain('12.ABC')
  })
})

/**
 * As apps consumidoras não importam `src/sefaz/*` — elas reexportam a primitiva a partir de um
 * serviço próprio. Se a superfície pública não trouxer isto, o release não serve para nada e o
 * consumidor descobre tarde.
 */
describe('a primitiva está na superfície pública do pacote', () => {
  test('padrões, normalização, DV e formatação saem pelo index', () => {
    expect(packageSurface.CNPJ_PATTERN.test(EMITENTE_CNPJ)).toBe(true)
    expect(packageSurface.CHAVE_PATTERN.test(`352607${EMITENTE_CNPJ}550010000000011000000014`)).toBe(true)
    expect(packageSurface.normalizeTaxId('12.abc.345/01de-35')).toBe(EMITENTE_CNPJ)
    expect(packageSurface.isCnpjValid(EMITENTE_CNPJ)).toBe(true)
    expect(packageSurface.calcularDvCnpj(EMITENTE_CNPJ.slice(0, 12))).toBe(EMITENTE_CNPJ.slice(12))
    expect(packageSurface.formatCnpjForDisplay(EMITENTE_CNPJ)).toBe('12.ABC.345/01DE-35')
    expect(typeof packageSurface.calcularDvChave).toBe('function')
    expect(typeof packageSurface.charValue).toBe('function')
  })
})
