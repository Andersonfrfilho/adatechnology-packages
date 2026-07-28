import { describe, expect, it } from 'bun:test'

import { resolveFileIconExtension } from './FileIcon'

describe('resolveFileIconExtension', () => {
  // Regressão: o painel de documentos passava só o mimeType, e o do Office é longo
  // (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`), então docx, doc,
  // xlsx e xls apareciam todos com o ícone genérico cinza.
  const OFFICE_MIME_TYPES = [
    {
      filename: 'contrato.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expected: 'docx',
    },
    { filename: 'procuracao.doc', mimeType: 'application/msword', expected: 'doc' },
    {
      filename: 'pedido.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      expected: 'xlsx',
    },
    { filename: 'tabela.xls', mimeType: 'application/vnd.ms-excel', expected: 'xls' },
  ]

  for (const testCase of OFFICE_MIME_TYPES) {
    it(`resolve ${testCase.expected} pelo nome, já que o mimeType do Office não bate`, () => {
      expect(resolveFileIconExtension(testCase.filename, testCase.mimeType)).toBe(testCase.expected)
    })
  }

  it('resolve pelo mimeType quando o nome não tem extensão conhecida', () => {
    expect(resolveFileIconExtension(undefined, 'application/pdf')).toBe('pdf')
    expect(resolveFileIconExtension('recibo', 'application/zip')).toBe('zip')
  })

  it('devolve algo fora do mapa para tipo desconhecido, caindo no ícone genérico', () => {
    expect(resolveFileIconExtension('lista-compras.txt', 'text/plain')).toBe('plain')
  })
})
