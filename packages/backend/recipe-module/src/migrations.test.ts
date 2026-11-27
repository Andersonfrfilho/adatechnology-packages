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

  it('tudo dentro do schema recipes, nada no public do host', () => {
    const sql = readdirSync(folder)
      .filter((file) => file.endsWith('.sql'))
      .map((file) => readFileSync(join(folder, file), 'utf8'))
      .join('\n')
    for (const match of sql.matchAll(/(?:TABLE|INDEX "[^"]+" ON) ("[^"]+")\./g)) expect(match[1]).toBe('"recipes"')
  })
})

describe('migration inicial', () => {
  const sql = readFileSync(join(folder, '0000_initial.sql'), 'utf8')

  it('cria o schema só se faltar (host que já criou o schema não quebra)', () => {
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS "recipes"')
  })

  it('linha só aponta para insumo da mesma empresa, e apagar insumo em uso é recusado pelo banco', () => {
    expect(sql).toContain(
      'FOREIGN KEY ("company_id","ingredient_id") REFERENCES "recipes"."ingredients"("company_id","id") ON DELETE restrict',
    )
    // O índice único alvo da FK composta tem de existir antes dela.
    expect(sql.indexOf('uq_ingredients_company_id')).toBeLessThan(sql.indexOf('recipe_lines_ingredient_fk'))
  })
})
