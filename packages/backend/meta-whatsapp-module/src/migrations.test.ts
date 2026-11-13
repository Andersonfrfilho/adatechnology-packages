/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Os bancos de staging/produção já registraram em `drizzle.meta_whatsapp_migrations` os NOMES das
 * quatro pastas da 0.1.0, e o migrator do drizzle-orm 1.x decide o que rodar pelo nome. Renomear ou
 * editar qualquer uma delas faz o migrator reaplicar `CREATE TABLE` num banco que já tem a tabela.
 * Este teste prende isso: nomes originais, conteúdo byte a byte (sha256 do `migration.sql` publicado
 * na 0.1.0), ausência do layout antigo (`meta/_journal.json`, que o migrator 1.x recusa) e ordem.
 */

import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = join(__dirname, 'migrations')

const ORIGINAL_MIGRATION_HASHES = {
  '20260725195853_freezing_switch': '5d11adaa10cee9e4364093bd24f76f2a7b3c315ca93b39ea1835f01370656d0e',
  '20260725210958_military_leper_queen': '65748aec96ec60f5f100b8f0b066c5c405cc3f61b23f92f86aabc6d19943c380',
  '20260725214800_illegal_black_tarantula': '4e4591ae09296e413ea9543a9b523cf048e91fbbd041ba98fba73b8e33dafb86',
  '20260725234507_normal_viper': 'edaee74650dd8dad2e75855bc43c7d32d59fb829078edfa60915f29c327a1645',
} as const

function migrationNames(): readonly string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

describe('migrations embarcadas', () => {
  it('não existe o layout antigo — o migrator do drizzle-orm 1.x o recusa', () => {
    expect(readdirSync(MIGRATIONS_DIR)).not.toContain('meta')
    expect(existsSync(join(MIGRATIONS_DIR, 'meta', '_journal.json'))).toBe(false)
    for (const name of migrationNames()) {
      expect(name).toMatch(/^\d{14}_[a-z0-9_]+$/)
      expect(existsSync(join(MIGRATIONS_DIR, name, 'migration.sql'))).toBe(true)
    }
  })

  it('os quatro nomes originais da 0.1.0 continuam existindo, na frente da fila', () => {
    expect(migrationNames().slice(0, 4)).toEqual(Object.keys(ORIGINAL_MIGRATION_HASHES))
  })

  it('o conteúdo das quatro originais é idêntico ao publicado na 0.1.0', () => {
    for (const [name, expectedHash] of Object.entries(ORIGINAL_MIGRATION_HASHES)) {
      const sql = readFileSync(join(MIGRATIONS_DIR, name, 'migration.sql'))
      expect(createHash('sha256').update(sql).digest('hex')).toBe(expectedHash)
    }
  })

  it('os timestamps são estritamente crescentes e as novas vêm depois das originais', () => {
    const timestamps = migrationNames().map((name) => Number(name.slice(0, 14)))
    for (let index = 1; index < timestamps.length; index += 1) {
      expect(timestamps[index]).toBeGreaterThan(Number(timestamps[index - 1]))
    }
    expect(migrationNames().length).toBe(11)
  })

  it('nenhuma migration carrega parâmetro de bind — DDL é sempre literal', () => {
    const offenders = migrationNames().flatMap((name) => {
      const sql = readFileSync(join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8')
      return (sql.match(/\$[0-9]+/g) ?? []).map((match) => `${name}: ${match}`)
    })
    expect(offenders).toEqual([])
  })
})
