/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type SpreadsheetCell = string | number | null

export type SpreadsheetTable = {
  readonly header: readonly string[]
  readonly rows: readonly (readonly SpreadsheetCell[])[]
}
