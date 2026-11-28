/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { buildCsv } from './csv'
import { buildXlsx, columnName } from './xlsx'
import { crc32 } from './zip'

/** Lê o diretório central do ZIP e confere o CRC de cada entrada contra os bytes armazenados. */
function readZip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const endOffset = bytes.length - 22
  expect(view.getUint32(endOffset, true)).toBe(0x06054b50)
  const count = view.getUint16(endOffset + 10, true)
  let offset = view.getUint32(endOffset + 16, true)
  const decoder = new TextDecoder()
  const files = new Map<string, string>()
  for (let index = 0; index < count; index += 1) {
    expect(view.getUint32(offset, true)).toBe(0x02014b50)
    const crc = view.getUint32(offset + 16, true)
    const size = view.getUint32(offset + 20, true)
    const nameLength = view.getUint16(offset + 28, true)
    const localOffset = view.getUint32(offset + 42, true)
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true)
    const data = bytes.subarray(dataStart, dataStart + size)
    expect(crc32(data)).toBe(crc)
    files.set(name, decoder.decode(data))
    offset += 46 + nameLength
  }
  return files
}

describe('CSV', () => {
  it('BOM, aspas, vírgula e quebra de linha', () => {
    const csv = buildCsv({
      header: ['nome', 'valor'],
      rows: [
        ['Ana, "A"', 1250],
        ['linha\nnova', null],
      ],
    })
    expect(csv).toBe('﻿nome,valor\r\n"Ana, ""A""",1250\r\n"linha\nnova",\r\n')
  })

  it('neutraliza fórmula (injeção de CSV)', () => {
    expect(buildCsv({ header: ['x'], rows: [['=HYPERLINK("http://mal")'], ['+1'], ['@SUM(A1)']] })).toBe(
      '﻿x\r\n"\'=HYPERLINK(""http://mal"")"\r\n\'+1\r\n\'@SUM(A1)\r\n',
    )
  })
})

describe('XLSX', () => {
  it('CRC32 padrão', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  it('colunas além de Z', () => {
    expect([0, 25, 26, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'ZZ', 'AAA'])
  })

  it('zip válido com as partes do OOXML, texto escapado e número como número', () => {
    const bytes = buildXlsx({
      table: {
        header: ['Código', 'Desconto'],
        rows: [
          ['<A&B>', 1250],
          ['=1+1', null],
        ],
      },
      sheetName: 'Resgates',
    })
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
    const files = readZip(bytes)
    expect([...files.keys()].sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ])
    const sheet = files.get('xl/worksheets/sheet1.xml') ?? ''
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">&lt;A&amp;B&gt;</t></is></c>')
    expect(sheet).toContain('<c r="B2"><v>1250</v></c>')
    expect(sheet).toContain("'=1+1")
    expect(files.get('xl/workbook.xml')).toContain('name="Resgates"')
  })
})

describe('XLSX com caractere de controle', () => {
  it('remove o que o XML 1.0 proíbe e mantém tab e quebra de linha', () => {
    const files = readZip(buildXlsx({ table: { header: ['x'], rows: [['a\u0001b\tc\nd']] } }))
    expect(files.get('xl/worksheets/sheet1.xml')).toContain('>ab\tc\nd<')
  })
})
