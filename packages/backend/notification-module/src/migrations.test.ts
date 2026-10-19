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

// `__dirname` e não `import.meta.dir`: é o que o `tsconfig` deste pacote aceita, e o mesmo que
// `runMigrations.ts` usa para achar esta pasta.
const MIGRATIONS_DIR = join(__dirname, 'migrations')

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

// ---------------------------------------------------------------------------------------------
// Formato v1 (drizzle-orm 1.x): pasta `<timestamp>_<nome>/migration.sql`, sem `meta/_journal.json`.
//
// O migrator 1.x recusa pasta com journal e decide "já aplicada" só pelo NOME da pasta; o 0.45
// exige o journal e decide pelo timestamp. Por isso o pacote publica os dois formatos, com o mesmo
// SQL. A prova contra Postgres dos quatro cenários está em `scripts/prove-migrations.ts`.
// ---------------------------------------------------------------------------------------------

const V1_DIR = join(__dirname, 'migrations-v1')

type JournalEntry = { readonly when: number; readonly tag: string }

function journalEntries(): readonly JournalEntry[] {
  const journal = JSON.parse(readFileSync(join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8')) as {
    entries: JournalEntry[]
  }
  return journal.entries
}

/** `when` truncado ao segundo, em UTC: `YYYYMMDDHHMMSS`, o mesmo que o drizzle-kit 1.x gera. */
function formatUTC(whenMs: number): string {
  const iso = new Date(Math.floor(whenMs / 1000) * 1000).toISOString()
  return iso.replace(/[-:T]/g, '').slice(0, 14)
}

function v1Folders(): readonly string[] {
  return readdirSync(V1_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

describe('migrations-v1 (drizzle-orm 1.x)', () => {
  it('cada entrada do journal tem pasta v1 com o mesmo SQL, byte a byte', () => {
    for (const entry of journalEntries()) {
      const name = `${formatUTC(entry.when)}_${entry.tag.replace(/^\d+_/, '')}`
      const legacy = readFileSync(join(MIGRATIONS_DIR, `${entry.tag}.sql`))
      const v1 = readFileSync(join(V1_DIR, name, 'migration.sql'))

      expect(v1.equals(legacy)).toBe(true)
    }
  })

  it('as pastas não têm journal nem snapshot — o migrator 1.x recusa o formato antigo', () => {
    for (const folder of v1Folders()) {
      expect(readdirSync(join(V1_DIR, folder))).toEqual(['migration.sql'])
    }
    expect(readdirSync(V1_DIR).filter((name) => name === 'meta')).toEqual([])
  })

  it('mantém os três nomes da 0.1.0-rc.3, que a TransportAdA já aplicou', () => {
    const folders = v1Folders()

    for (const name of [
      '20260802053704_melodic_selene',
      '20260802130118_jittery_raider',
      '20260802131549_bizarre_dagger',
    ]) {
      expect(folders).toContain(name)
    }
  })

  it('todo CREATE é condicional e todo ADD CONSTRAINT está em bloco duplicate_object', () => {
    for (const folder of v1Folders()) {
      const sql = readFileSync(join(V1_DIR, folder, 'migration.sql'), 'utf8')
      const code = sql
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')

      expect(code.match(/CREATE (SCHEMA|TABLE|(UNIQUE )?INDEX)\s+"/gi) ?? []).toEqual([])
      expect((code.match(/ADD CONSTRAINT/gi) ?? []).length).toBe(
        (code.match(/WHEN duplicate_object THEN null/gi) ?? []).length,
      )
      expect(code.match(/ADD COLUMN\s+"/gi) ?? []).toEqual([])
    }
  })

  it('o build copia as duas pastas para o dist', () => {
    const config = readFileSync(join(__dirname, '..', 'tsup.config.ts'), 'utf8')

    expect(config).toContain('dist/migrations-v1')
    expect(config).toContain('src/migrations-v1/*')
    expect(config).toContain('src/migrations/*')
  })
})
