/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A primeira migration cria o schema `conversation` — e precisa fazer isso de forma idempotente
 * (D8, spec 211 T202): o migrator é injetado pelo host (`runConversationMigrations`), e sem
 * `IF NOT EXISTS` uma segunda aplicação contra um banco onde o schema já existe por outro caminho
 * derruba a subida com `42P06`. Sem Postgres aqui de propósito, no molde de
 * `notification-module/migrations.test.ts`: o que se verifica é a FORMA do SQL, verificável por
 * leitura, e roda em qualquer `bun test`.
 *
 * ⚠️ O layout é o do `drizzle-kit@1.x`: uma pasta por migration (`<timestamp>_<nome>/migration.sql`),
 * que é o que o `drizzle-orm@1.x` do consumidor sabe ler. O layout antigo (`0000_nome.sql` mais
 * `meta/_journal.json`) faz o migrator do consumidor falhar na subida — foi assim que o primeiro
 * host descobriu, ao ligar as migrations do pacote no `pre-deploy`.
 */

import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = join(__dirname, 'migrations')

/** Uma pasta por migration, nomeada pelo timestamp — a ordem alfabética é a ordem de aplicação. */
function migrationFiles(): readonly string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(entry.name, 'migration.sql'))
    .sort()
}

describe('migrations embarcadas', () => {
  it('existe ao menos uma, senão o teste passa por vacuidade', () => {
    expect(migrationFiles().length).toBeGreaterThan(0)
  })

  it('cada migration mora na própria pasta, no layout que o drizzle-orm 1.x lê', () => {
    expect(readdirSync(MIGRATIONS_DIR)).not.toContain('meta')
    for (const file of migrationFiles()) {
      expect(file).toMatch(/^\d{14}_[a-z0-9_]+\/migration\.sql$/)
    }
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
