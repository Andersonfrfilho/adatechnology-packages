/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const folder = join(__dirname, 'migrations')

describe('migrations', () => {
  it('formato clássico: todo SQL tem entrada no meta/_journal.json, na ordem', () => {
    const journal = JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf8')) as {
      entries: { idx: number; tag: string }[]
    }
    const files = readdirSync(folder)
      .filter((file) => file.endsWith('.sql'))
      .sort()
    expect(journal.entries.map((entry) => `${entry.tag}.sql`)).toEqual(files)
    expect(journal.entries.map((entry) => entry.idx)).toEqual(files.map((_file, index) => index))
  })

  it('tudo dentro do schema stock, nada no public do host', () => {
    const sql = readdirSync(folder)
      .filter((file) => file.endsWith('.sql'))
      .map((file) => readFileSync(join(folder, file), 'utf8'))
      .join('\n')
    for (const match of sql.matchAll(/(?:TABLE|INDEX "[^"]+" ON) ("[^"]+")\./g)) expect(match[1]).toBe('"stock"')
  })
})

describe('migration inicial', () => {
  const sql = readFileSync(join(folder, '0000_initial.sql'), 'utf8')

  it('cria o schema só se faltar (host que já criou o schema não quebra)', () => {
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS "stock"')
  })

  it('um inventário aberto por empresa e chave de baixa única, no banco', () => {
    expect(sql).toContain(
      `CREATE UNIQUE INDEX "uq_inventory_counts_open" ON "stock"."inventory_counts" USING btree ("company_id") WHERE "status" = 'open'`,
    )
    expect(sql).toContain('CONSTRAINT "deductions_company_id_source_key_pk" PRIMARY KEY("company_id","source_key")')
    expect(sql).toContain('"remaining_quantity" >= 0 and "remaining_quantity" <= "quantity"')
  })
})
