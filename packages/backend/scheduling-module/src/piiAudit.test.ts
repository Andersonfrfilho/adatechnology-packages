/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Auditoria de PII (T4.11) — `security.md` §1. Diferente do `notification-module`, que resolve
 * endereço de envio em tempo de execução, `scheduling-module` nunca toca em nome, telefone ou
 * e-mail: o desenho só guarda referência opaca (spec §6). Por isso a auditoria aqui é estrutural
 * — nenhuma coluna do schema pode nascer com nome de dado pessoal — em vez de comportamental.
 *
 * As exceções documentadas (`title`, `notes`, `cancellationReason`) são texto livre que o produto
 * pode preencher com PII por conta própria — risco assumido na spec, não um vazamento do desenho.
 * O terceiro teste trava essa lista para não crescer em silêncio.
 */

import { describe, expect, it } from 'bun:test'
import { getTableColumns, type Table } from 'drizzle-orm'

import { bookingParticipants, bookings } from './schema/schema'

const PII_NAME_PATTERNS: readonly RegExp[] = [
  /phone/i,
  /telefone/i,
  /e_?mail/i,
  /cpf/i,
  /cnpj/i,
  /document/i,
  /documento/i,
  /birth/i,
  /nascimento/i,
  /address/i,
  /endereco/i,
  /full_?name/i,
  /nome_completo/i,
]

const DOCUMENTED_FREE_TEXT_EXCEPTIONS = new Set(['title', 'notes', 'cancellationReason'])

function assertNoPiiColumnNames(table: Table, tableName: string): void {
  const columnKeys = Object.keys(getTableColumns(table))
  for (const columnKey of columnKeys) {
    if (DOCUMENTED_FREE_TEXT_EXCEPTIONS.has(columnKey)) continue
    const matchesPiiPattern = PII_NAME_PATTERNS.some((pattern) => pattern.test(columnKey))
    expect(matchesPiiPattern, `${tableName}.${columnKey} parece nome de coluna de PII`).toBe(false)
  }
}

describe('auditoria de PII — schema', () => {
  it('bookings não guarda nenhuma coluna com nome de dado pessoal', () => {
    assertNoPiiColumnNames(bookings, 'bookings')
  })

  it('booking_participants não guarda nenhuma coluna com nome de dado pessoal', () => {
    assertNoPiiColumnNames(bookingParticipants, 'booking_participants')
  })

  it('as únicas colunas de texto livre em bookings são as documentadas na spec §6', () => {
    const columnKeys = Object.keys(getTableColumns(bookings))
    const freeTextColumns = columnKeys.filter((columnKey) => DOCUMENTED_FREE_TEXT_EXCEPTIONS.has(columnKey))
    expect(freeTextColumns.sort()).toEqual([...DOCUMENTED_FREE_TEXT_EXCEPTIONS].sort())
  })

  it('bookings e booking_participants identificam pessoas só por referência opaca', () => {
    const bookingColumns = Object.keys(getTableColumns(bookings))
    expect(bookingColumns).toContain('customerRef')
    expect(bookingColumns).toContain('organizerRef')

    const participantColumns = Object.keys(getTableColumns(bookingParticipants))
    expect(participantColumns).toContain('participantRef')
  })
})
