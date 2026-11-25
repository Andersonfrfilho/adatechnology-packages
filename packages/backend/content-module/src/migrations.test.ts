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

  it('tudo dentro do schema content, nada no public do host', () => {
    const sql = readdirSync(folder)
      .filter((file) => file.endsWith('.sql'))
      .map((file) => readFileSync(join(folder, file), 'utf8'))
      .join('\n')
    for (const match of sql.matchAll(/(?:TABLE|INDEX "[^"]+" ON) ("[^"]+")\./g)) expect(match[1]).toBe('"content"')
  })
})
