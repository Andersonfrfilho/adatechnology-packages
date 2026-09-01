import { describe, expect, test } from 'bun:test'

import { readCrlv } from './crlv.service'
import { getLegacyDocument } from './pdfDocument.helper'
import { buildCrlvPdf, VALID_CRLV_RENAVAM } from './pdfFixture.helper'
import { readPdfTextLayer } from './pdfTextLayer.service'

async function readCrlvFixture(overrides: Readonly<Record<string, string>> = {}) {
  const page = await readPdfTextLayer({ data: buildCrlvPdf(overrides), getDocument: getLegacyDocument })
  return readCrlv(page)
}

describe('leitura do CRLV', () => {
  test('extrai o veículo, o proprietário e a origem de um PDF de verdade', async () => {
    const { values } = await readCrlvFixture()

    expect(values.plate).toBe('GCQ8E47')
    expect(values.renavam).toBe(VALID_CRLV_RENAVAM)
    expect(values.modelYear).toBe('2021')
    expect(values.axleCount).toBe('2')
    expect(values.ownerName).toBe('MARIA DE SOUSA')
    expect(values.ownerTaxId).toBe('11144477735')
  })

  /** A versão faz parte do modelo; a marca não. É o primeiro `/` que decide. */
  test('parte marca e modelo no primeiro separador, mantendo a versão no modelo', async () => {
    const { values } = await readCrlvFixture()

    expect(values.brand).toBe('FIAT')
    expect(values.model).toBe('FIORINO ENDURANCE 1.4')
  })

  /**
   * O município é o que faz o CRLV atravessar bloco: ele preenche Cidade, que não é campo de
   * veículo. A barra que decide é a **última** — nome de município pode conter uma.
   */
  test('parte município e UF na última barra', async () => {
    const { values } = await readCrlvFixture()

    expect(values.municipality).toBe('SAO PAULO')
    expect(values.state).toBe('SP')
  })

  test('mantém o município quando ele mesmo tem barra no nome', async () => {
    const { values } = await readCrlvFixture({ 'MUNICIPIO / UF': 'EMBU / SP' })

    expect(values.municipality).toBe('EMBU')
    expect(values.state).toBe('SP')
  })

  /** O app indexa a tabela de tradução pelo texto normalizado; normalizar aqui evita a divergência. */
  test('devolve carroceria, cor e combustível impressos e normalizados, sem traduzir', async () => {
    const { values } = await readCrlvFixture()

    expect(values.bodyType).toBe('FURGAO')
    expect(values.color).toBe('BRANCA')
    expect(values.fuel).toBe('ALCOOL/GASOLINA')
  })

  test('não inventa dígito verificador: placa e RENAVAM errados viram aviso, não valor', async () => {
    const { remarks, values } = await readCrlvFixture({
      'CODIGO RENAVAM': '00123456780',
      PLACA: 'GCQ8E4',
    })

    expect(values.plate).toBeUndefined()
    expect(values.renavam).toBeUndefined()
    expect(remarks).toContainEqual({ field: 'plate', reason: 'checkDigitFailed' })
    expect(remarks).toContainEqual({ field: 'renavam', reason: 'checkDigitFailed' })
  })

  test('CPF do proprietário com dígito errado vira aviso, e o nome continua lido', async () => {
    const { remarks, values } = await readCrlvFixture({ 'CPF / CNPJ': '111.444.777-36' })

    expect(values.ownerTaxId).toBeUndefined()
    expect(values.ownerName).toBe('MARIA DE SOUSA')
    expect(remarks).toContainEqual({ field: 'ownerTaxId', reason: 'checkDigitFailed' })
  })

  /** O `*` do Detran é campo vazio, nunca `0` — eixos zerados mudariam a classe do veículo. */
  test('trata o asterisco do Detran como ausência, com o motivo à vista', async () => {
    const { remarks, values } = await readCrlvFixture({ EIXOS: '*' })

    expect(values.axleCount).toBeUndefined()
    expect(remarks).toContainEqual({ field: 'axleCount', reason: 'notInformed' })
  })

  test('UF fora das 27 não preenche estado', async () => {
    const { remarks, values } = await readCrlvFixture({ 'MUNICIPIO / UF': 'LISBOA / PT' })

    expect(values.state).toBeUndefined()
    expect(values.municipality).toBe('LISBOA')
    expect(remarks).toContainEqual({ field: 'state', reason: 'notReadable' })
  })

  /** Ano de duas casas é leitura errada, não ano novo. */
  test('descarta ano-modelo que não tem quatro dígitos', async () => {
    const { values } = await readCrlvFixture({ 'ANO MODELO': '21' })

    expect(values.modelYear).toBeUndefined()
  })
})
