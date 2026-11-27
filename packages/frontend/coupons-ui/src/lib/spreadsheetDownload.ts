/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  buildCsv,
  buildXlsx,
  CSV_CONTENT_TYPE,
  XLSX_CONTENT_TYPE,
  type ExportFormat,
  type SpreadsheetTable,
} from '@adatechnology/coupon-contracts'

/** "Página atual": o arquivo sai no navegador, com o mesmo gerador do servidor. */
export function buildSpreadsheetBlob(table: SpreadsheetTable, format: ExportFormat): Blob {
  if (format === 'xlsx') {
    const bytes = buildXlsx({ table })
    return new Blob([new Uint8Array(bytes).buffer], { type: XLSX_CONTENT_TYPE })
  }
  return new Blob([buildCsv(table)], { type: CSV_CONTENT_TYPE })
}

export function downloadBlob(blob: Blob, fileName: string): void {
  if (typeof document === 'undefined') return
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
