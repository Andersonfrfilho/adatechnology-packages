/* Copyright (c) 2026 Ada Technology. MIT License. */
import { describe, expect, test } from 'bun:test'

import { identifyDocumentKind } from './documentKind.service'
import type { PdfPageText, PdfTextFragment } from './pdfTextLayer.service'

const PAGE_HEIGHT = 800

/** `y` cresce para cima, origem no canto inferior: título alto é `y` grande. */
function fragment(text: string, y: number): PdfTextFragment {
  return { height: 12, text, x: 40, y }
}

function page(fragments: readonly PdfTextFragment[]): PdfPageText {
  return { fragments, height: PAGE_HEIGHT }
}

describe('identificação do tipo de documento', () => {
  test('página sem fragmento nenhum é documento escaneado', () => {
    expect(identifyDocumentKind(page([]))).toBe('scanned')
  })

  test('documento desconhecido não vira palpite', () => {
    expect(identifyDocumentKind(page([fragment('CONTRATO DE ALGUMA COISA', 760)]))).toBe('unknown')
  })

  test('o CRLV continua sendo reconhecido pelo título', () => {
    const kind = identifyDocumentKind(
      page([fragment('CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEÍCULO - DIGITAL', 760)]),
    )

    expect(kind).toBe('crlv')
  })

  /**
   * O título do CCMEI é impresso em duas linhas — conferido numa amostra real. Casá-lo dentro de um
   * fragmento só, como o CRLV permite, não reconheceria documento algum.
   */
  test('o CCMEI é reconhecido com o título quebrado em duas linhas', () => {
    const kind = identifyDocumentKind(
      page([fragment('Certificado da Condição de', 770), fragment('Microempreendedor Individual', 755)]),
    )

    expect(kind).toBe('ccmei')
  })

  test('o CCMEI também é reconhecido quando o título cabe numa linha só', () => {
    const kind = identifyDocumentKind(page([fragment('CERTIFICADO DA CONDIÇÃO DE MICROEMPREENDEDOR INDIVIDUAL', 760)]))

    expect(kind).toBe('ccmei')
  })

  /**
   * A regra da faixa é o que separa "título" de "palavra solta": o CRLV traz "CNH" no rodapé, e um
   * classificador que varre a folha inteira chama todo CRLV de habilitação. Vale igual para o CCMEI.
   */
  test('a mesma frase fora da faixa do título não identifica o documento', () => {
    const kind = identifyDocumentKind(page([fragment('Certificado da Condição de Microempreendedor Individual', 120)]))

    expect(kind).not.toBe('ccmei')
  })

  /** Duas linhas distantes não são um título quebrado — são duas frases que por acaso se somam. */
  test('não junta linhas distantes para inventar um título', () => {
    const kind = identifyDocumentKind(
      page([fragment('Certificado da Condição de', 780), fragment('Microempreendedor Individual', 570)]),
    )

    expect(kind).not.toBe('ccmei')
  })
})
