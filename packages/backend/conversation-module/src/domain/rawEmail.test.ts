/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * T305 (RF14): o `sha256` do MIME bruto é calculado sobre os **bytes exatamente como chegaram**,
 * antes de qualquer interpretação — nunca sobre uma versão decodificada, decodificada de novo com
 * outro conjunto de caracteres, ou com quebra de linha normalizada. Vermelho até a T306 criar
 * `rawEmail.ts`.
 */
import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'

import { computeRawEmailSha256 } from './rawEmail'

/**
 * Um MIME com quebra de linha CRLF e LF misturadas, e um cabeçalho `=?utf-8?...?=` — dois pontos em
 * que interpretar o conteúdo (parsear o MIME, decodificar o cabeçalho, normalizar a quebra de linha)
 * produz bytes diferentes dos originais.
 */
const RAW_MIME_WITH_MIXED_LINE_ENDINGS_AND_ENCODED_HEADER = new TextEncoder().encode(
  'Subject: =?utf-8?Q?Ol=C3=A1,_tudo_bem=3F?=\r\n' +
    'Content-Type: text/plain; charset=utf-8\n' +
    'Message-ID: <abc123@mail.example.com>\r\n' +
    '\r\n' +
    'Primeira linha\r\n' +
    'Segunda linha\n' +
    'Terceira linha\r\n',
)

describe('computeRawEmailSha256 (RF14: o hash é dos bytes, antes de qualquer interpretação)', () => {
  it('bate exatamente com o sha256 dos bytes recebidos, sem decodificar nada', () => {
    const expected = createHash('sha256').update(RAW_MIME_WITH_MIXED_LINE_ENDINGS_AND_ENCODED_HEADER).digest('hex')

    expect(computeRawEmailSha256(RAW_MIME_WITH_MIXED_LINE_ENDINGS_AND_ENCODED_HEADER)).toBe(expected)
  })

  it('normalizar a quebra de linha como um parser faria mudaria o hash — a função não normaliza', () => {
    const asText = new TextDecoder('utf-8').decode(RAW_MIME_WITH_MIXED_LINE_ENDINGS_AND_ENCODED_HEADER)
    const normalizedLikeAParserWould = new TextEncoder().encode(
      asText.replaceAll('\r\n', '\n').replaceAll('\n', '\r\n'),
    )

    expect(computeRawEmailSha256(RAW_MIME_WITH_MIXED_LINE_ENDINGS_AND_ENCODED_HEADER)).not.toBe(
      computeRawEmailSha256(normalizedLikeAParserWould),
    )
  })

  it('é determinístico: os mesmos bytes produzem sempre o mesmo hash', () => {
    expect(computeRawEmailSha256(RAW_MIME_WITH_MIXED_LINE_ENDINGS_AND_ENCODED_HEADER)).toBe(
      computeRawEmailSha256(RAW_MIME_WITH_MIXED_LINE_ENDINGS_AND_ENCODED_HEADER),
    )
  })
})
