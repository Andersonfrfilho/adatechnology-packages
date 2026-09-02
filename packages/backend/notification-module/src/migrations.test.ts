/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * As migrations embarcadas precisam ser CONVERGENTES, não sequenciais.
 *
 * O motivo é concreto: a `0000` atual espremeu as três da 0.1.0-rc.2 num único ponto de partida,
 * com timestamp posterior a elas. Num banco que já rodou a rc.2, o migrator a considera nova e a
 * executa — e um `CREATE SCHEMA` cru derrubava a api do host no boot. O upgrade do pacote quebrava
 * exatamente quem já era usuário dele.
 *
 * Sem Postgres aqui de propósito: o que se verifica é a FORMA do SQL, e ela é verificável por
 * leitura. Um teste de integração cobriria o mesmo e só rodaria onde houvesse banco — aqui roda
 * em qualquer `bun test`, que é onde a regressão seria introduzida.
 */

import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = join(import.meta.dir, 'migrations')

function migrationFiles(): readonly string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
}

/** Sem comentários: `-- CREATE TABLE ...` num cabeçalho não é comando, e não deve ser cobrado. */
function statementsOf(file: string): readonly string[] {
  return readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    .split('--> statement-breakpoint')
    .flatMap((block) => block.split('\n'))
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('--'))
}

describe('migrations embarcadas', () => {
  it('existe ao menos uma, senão o teste passa por vacuidade', () => {
    expect(migrationFiles().length).toBeGreaterThan(0)
  })

  it('todo CREATE é condicional — o baseline pode encontrar o banco em qualquer estado anterior', () => {
    const offenders = migrationFiles().flatMap((file) =>
      statementsOf(file)
        .filter((line) => /^CREATE (SCHEMA|TABLE|(UNIQUE )?INDEX)\s+"/i.test(line))
        .map((line) => `${file}: ${line.slice(0, 80)}`),
    )

    expect(offenders).toEqual([])
  })

  it('todo ADD COLUMN é condicional', () => {
    const offenders = migrationFiles().flatMap((file) =>
      statementsOf(file)
        .filter((line) => /ADD COLUMN\s+"/i.test(line))
        .map((line) => `${file}: ${line.slice(0, 80)}`),
    )

    expect(offenders).toEqual([])
  })

  it('todo ADD CONSTRAINT vive num bloco que engole duplicata — o Postgres não tem IF NOT EXISTS aqui', () => {
    for (const file of migrationFiles()) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
      const additions = sql.match(/ADD CONSTRAINT/gi) ?? []
      const guards = sql.match(/WHEN duplicate_object THEN null/gi) ?? []

      expect(guards.length).toBe(additions.length)
    }
  })
})
