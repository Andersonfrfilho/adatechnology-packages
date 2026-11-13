/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'bun:test'

import { userMigrationsFolder } from './runMigrations'

const folder = userMigrationsFolder()

/**
 * O host roda as migrations com o `migrate` do `drizzle-orm`, que le APENAS o formato classico:
 * `meta/_journal.json` mais um `.sql` numerado por entrada.
 *
 * O `drizzle-kit` 1.x gera outro formato — uma pasta por migration, com `snapshot.json` e sem
 * journal. Publicar nesse formato nao quebra nenhum teste do pacote e nao quebra o build: quebra o
 * deploy do host, no passo de migration, depois de a imagem ja ter subido. Foi exatamente assim que
 * apareceu da primeira vez.
 */
describe('formato das migrations publicadas', () => {
  it('tem o journal que o migrator do drizzle-orm exige', () => {
    expect(existsSync(join(folder, 'meta', '_journal.json'))).toBe(true)
  })

  it('toda entrada do journal tem o .sql correspondente', () => {
    const journal = JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf8')) as {
      entries: readonly { tag: string }[]
    }

    expect(journal.entries.length).toBeGreaterThan(0)
    for (const entry of journal.entries) {
      expect(existsSync(join(folder, `${entry.tag}.sql`))).toBe(true)
    }
  })

  it('todo .sql esta declarado no journal — arquivo solto nunca roda', () => {
    const journal = JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf8')) as {
      entries: readonly { tag: string }[]
    }
    const declared = new Set(journal.entries.map((entry) => `${entry.tag}.sql`))

    for (const file of readdirSync(folder).filter((name) => name.endsWith('.sql'))) {
      expect(declared.has(file)).toBe(true)
    }
  })

  it('nao ha pasta de migration no formato do drizzle-kit 1.x', () => {
    const folders = readdirSync(folder, { withFileTypes: true }).filter(
      (entry) => entry.isDirectory() && entry.name !== 'meta',
    )

    expect(folders.map((entry) => entry.name)).toEqual([])
  })
})
