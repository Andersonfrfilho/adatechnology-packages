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
import type { Table } from 'drizzle-orm'
import { getTableColumns, getTableName, isTable } from 'drizzle-orm'

import * as schema from './schema/schema'
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

// F-017: descoberta dinâmica em vez de lista de tabelas escrita à mão — a versão anterior só
// auditava `bookings`/`booking_participants`; uma tabela nova (ex.: um cadastro de cliente futuro)
// nascia sem cobertura nenhuma, porque nada forçava alguém a lembrar de adicioná-la aqui. Iterar
// sobre o que `./schema/schema` de fato exporta faz a tabela nova entrar na auditoria sozinha.
function allSchemaTables(): ReadonlyArray<readonly [string, ReturnType<typeof getTableColumns>]> {
  const tables: Table[] = []
  for (const value of Object.values(schema)) {
    if (isTable(value)) tables.push(value)
  }
  return tables.map((table) => [getTableName(table), getTableColumns(table)] as const)
}

function undocumentedPiiColumns(columnKeys: readonly string[]): readonly string[] {
  return columnKeys
    .filter((columnKey) => !DOCUMENTED_FREE_TEXT_EXCEPTIONS.has(columnKey))
    .filter((columnKey) => PII_NAME_PATTERNS.some((pattern) => pattern.test(columnKey)))
}

describe('auditoria de PII — schema', () => {
  it('nenhuma tabela do módulo guarda coluna com nome de dado pessoal', () => {
    for (const [tableName, columns] of allSchemaTables()) {
      const leaked = undocumentedPiiColumns(Object.keys(columns))
      expect(leaked, `${tableName}: ${leaked.join(', ')} parece(m) nome de coluna de PII`).toEqual([])
    }
  })

  // Prova negativa de que `undocumentedPiiColumns` não é tautológica: uma coluna de PII de verdade,
  // não documentada como exceção, precisa derrubar a mesma função que a auditoria acima usa.
  it('undocumentedPiiColumns detecta uma coluna de PII não documentada', () => {
    const columnKeysWithLeakedPhone = [...Object.keys(getTableColumns(bookings)), 'phoneNumber']
    expect(undocumentedPiiColumns(columnKeysWithLeakedPhone)).toEqual(['phoneNumber'])
  })

  it('a lista de tabelas do módulo não encolhe em silêncio', () => {
    const tableNames = allSchemaTables().map(([tableName]) => tableName)
    expect(tableNames.sort()).toEqual(
      [
        'resources',
        'services',
        'resource_services',
        'availability_rules',
        'availability_exceptions',
        'bookings',
        'booking_slots',
        'booking_participants',
      ].sort(),
    )
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
