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

  it('tudo dentro do schema coupons, nada no public do host', () => {
    const sql = readdirSync(folder)
      .filter((file) => file.endsWith('.sql'))
      .map((file) => readFileSync(join(folder, file), 'utf8'))
      .join('\n')
    for (const match of sql.matchAll(/(?:TABLE|INDEX "[^"]+" ON) ("[^"]+")\./g)) expect(match[1]).toBe('"coupons"')
  })
})

describe('migration inicial', () => {
  const sql = readFileSync(join(folder, '0000_initial.sql'), 'utf8')

  it('cria o schema só se faltar (host que já criou o schema não quebra)', () => {
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS "coupons"')
  })

  it('o banco recusa percentual acima de 100 e desconto zero', () => {
    expect(sql).toContain(`"discount_kind" <> 'percent' or "discount_value" <= 100`)
    expect(sql).toContain('"discount_value" > 0')
  })
})
