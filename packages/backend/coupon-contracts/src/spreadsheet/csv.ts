/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { SpreadsheetCell, SpreadsheetTable } from './spreadsheet.types'

/** Abre acentuado certo no Excel, que sem o BOM lê o arquivo como Latin-1. */
export const CSV_BOM = '﻿'
export const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8'

/**
 * Célula que começa com `=`, `+`, `-`, `@`, tab ou CR vira fórmula na planilha (injeção de CSV):
 * um nome de lead "=HYPERLINK(...)" executaria no computador de quem exporta. Prefixa com `'`.
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function formatCsvCell(cell: SpreadsheetCell): string {
  if (cell === null) return ''
  if (typeof cell === 'number') return String(cell)
  const text = neutralizeFormula(cell)
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildCsvLine(cells: readonly SpreadsheetCell[]): string {
  return `${cells.map(formatCsvCell).join(',')}\r\n`
}

export function buildCsv(table: SpreadsheetTable): string {
  return CSV_BOM + buildCsvLine(table.header) + table.rows.map(buildCsvLine).join('')
}
