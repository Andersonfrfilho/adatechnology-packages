/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Planilha XLSX de uma aba, sem dependência: texto como `inlineStr`, número como número. Abre no
 * Excel, LibreOffice e Google Planilhas.
 */

import { neutralizeFormula } from './csv'
import type { SpreadsheetCell, SpreadsheetTable } from './spreadsheet.types'
import { buildZip } from './zip'

export const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'

// Caractere de controle é proibido em XML 1.0: a planilha inteira deixaria de abrir.
function isAllowedXmlCharacter(character: string): boolean {
  const code = character.charCodeAt(0)
  return code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d
}

function escapeXml(value: string): string {
  return [...value]
    .filter(isAllowedXmlCharacter)
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function columnName(index: number): string {
  let name = ''
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26))
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name
  return name
}

function cellXml(cell: SpreadsheetCell, reference: string): string {
  if (cell === null) return ''
  if (typeof cell === 'number' && Number.isFinite(cell)) return `<c r="${reference}"><v>${cell}</v></c>`
  const text = escapeXml(neutralizeFormula(String(cell)))
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`
}

function rowXml(cells: readonly SpreadsheetCell[], rowIndex: number): string {
  const row = rowIndex + 1
  return `<row r="${row}">${cells.map((cell, column) => cellXml(cell, `${columnName(column)}${row}`)).join('')}</row>`
}

function sheetXml(table: SpreadsheetTable): string {
  const rows = [table.header, ...table.rows].map(rowXml).join('')
  return `${XML_HEADER}<worksheet xmlns="${MAIN_NS}"><sheetData>${rows}</sheetData></worksheet>`
}

export function buildXlsx(params: { readonly table: SpreadsheetTable; readonly sheetName?: string }): Uint8Array {
  const encoder = new TextEncoder()
  const sheetName = escapeXml((params.sheetName ?? 'Planilha').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31))
  const files: Record<string, string> = {
    '[Content_Types].xml': `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `${XML_HEADER}<Relationships xmlns="${PKG_REL_NS}"><Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `${XML_HEADER}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `${XML_HEADER}<Relationships xmlns="${PKG_REL_NS}"><Relationship Id="rId1" Type="${REL_NS}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL_NS}/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': `${XML_HEADER}<styleSheet xmlns="${MAIN_NS}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf xfId="0"/></cellXfs></styleSheet>`,
    'xl/worksheets/sheet1.xml': sheetXml(params.table),
  }
  return buildZip(Object.entries(files).map(([name, content]) => ({ name, data: encoder.encode(content) })))
}
