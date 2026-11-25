/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { parseBulkImportCsv, parseCSV } from './csv'

describe('parseCSV', () => {
  it('mantém a primeira linha, aspas e vírgula dentro de aspas', () => {
    expect(parseCSV('a,b\n"x, y",z\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'z'],
    ])
  })
})

describe('parseBulkImportCsv', () => {
  it('casa cabeçalho sem acento nem caixa e descarta coluna desconhecida', () => {
    expect(parseBulkImportCsv('PREÇO,Nome,Cor\n10,Suco,azul')).toEqual([{ price: '10', name: 'Suco' }])
  })
})
