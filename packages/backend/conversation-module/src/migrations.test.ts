/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A primeira migration cria o schema `conversation` — e precisa fazer isso de forma idempotente
 * (D8, spec 211 T202): o migrator é injetado pelo host (`runConversationMigrations`), e sem
 * `IF NOT EXISTS` uma segunda aplicação contra um banco onde o schema já existe por outro caminho
 * derruba a subida com `42P06`. Sem Postgres aqui de propósito, no molde de
 * `notification-module/migrations.test.ts`: o que se verifica é a FORMA do SQL, verificável por
 * leitura, e roda em qualquer `bun test`.
 */

import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = join(__dirname, 'migrations')

function migrationFiles(): readonly string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
}

describe('migrations embarcadas', () => {
  it('existe ao menos uma, senão o teste passa por vacuidade', () => {
    expect(migrationFiles().length).toBeGreaterThan(0)
  })

  it('a primeira migration cria o schema do módulo com IF NOT EXISTS', () => {
    const first = migrationFiles()[0]
    expect(first).toBeDefined()
    const sql = readFileSync(join(MIGRATIONS_DIR, String(first)), 'utf8')
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS "conversation"')
  })

  /**
   * T202 (achado do coordenador): um CHECK gerado a partir de `${channel}` sem `sql.raw` saiu como
   * `"channel" <> $1` — parâmetro de bind dentro de DDL, que o Postgres recusa (constraint não tem
   * plano de execução parametrizável). Toda migration embarcada é SQL estático, nunca prepared
   * statement — `$<n>` aqui é sempre sinal de um valor que devia ter entrado como literal.
   */
  it('nenhuma migration carrega parâmetro de bind — DDL é sempre literal', () => {
    const offenders = migrationFiles().flatMap((file) => {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
      const matches = sql.match(/\$[0-9]+/g) ?? []
      return matches.map((match) => `${file}: ${match}`)
    })

    expect(offenders).toEqual([])
  })
})
