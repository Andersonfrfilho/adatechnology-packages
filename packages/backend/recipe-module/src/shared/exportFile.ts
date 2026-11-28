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
} from '@adatechnology/recipe-contracts'

export type ExportResult = {
  readonly body: string | Uint8Array
  readonly contentType: string
  readonly fileName: string
  readonly rowCount: number
  /** O filtro tinha mais linhas que o teto de exportação. */
  readonly isTruncated: boolean
}

export const DEFAULT_EXPORT_ROW_LIMIT = 10_000

export function buildExportFile(params: {
  readonly table: SpreadsheetTable
  readonly format: ExportFormat
  readonly baseName: string
  readonly now: Date
  readonly isTruncated: boolean
}): ExportResult {
  const stamp = params.now.toISOString().slice(0, 10)
  const fileName = `${params.baseName}-${stamp}.${params.format}`
  const shared = { fileName, rowCount: params.table.rows.length, isTruncated: params.isTruncated }
  if (params.format === 'xlsx')
    return { ...shared, body: buildXlsx({ table: params.table }), contentType: XLSX_CONTENT_TYPE }
  return { ...shared, body: buildCsv(params.table), contentType: CSV_CONTENT_TYPE }
}
