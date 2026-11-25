/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Os bancos de staging/produção já registraram em `drizzle.meta_whatsapp_migrations` os NOMES das
 * quatro pastas da 0.1.0, e o migrator do drizzle-orm 1.x decide o que rodar pelo nome. Renomear ou
 * editar qualquer uma delas faz o migrator reaplicar `CREATE TABLE` num banco que já tem a tabela.
 * Este teste prende isso: nomes originais, conteúdo byte a byte (sha256 do `migration.sql` publicado
 * na 0.1.0), ausência do layout antigo (`meta/_journal.json`, que o migrator 1.x recusa) e ordem.
 *
 * O pacote também publica `migrations-journal/` para o migrator do drizzle-orm 0.x, que exige o
 * journal. As duas pastas têm o mesmo SQL byte a byte, e o `when` do journal é o timestamp do nome da
 * pasta v1 — o mesmo `created_at` que o migrator 1.x grava.
 */

import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  META_WHATSAPP_MIGRATIONS_TABLE,
  metaWhatsAppMigrationsFolder,
  runMetaWhatsAppMigrations,
} from './runMigrations'

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

const JOURNAL_DIR = join(__dirname, 'migrations-journal')

type JournalEntry = { readonly idx: number; readonly when: number; readonly tag: string; readonly breakpoints: boolean }

function journalEntries(): readonly JournalEntry[] {
  const journal = JSON.parse(readFileSync(join(JOURNAL_DIR, 'meta', '_journal.json'), 'utf8')) as {
    entries: JournalEntry[]
  }
  return journal.entries
}

function folderMillis(name: string): number {
  const stamp = name.slice(0, 14)
  return Date.UTC(
    Number(stamp.slice(0, 4)),
    Number(stamp.slice(4, 6)) - 1,
    Number(stamp.slice(6, 8)),
    Number(stamp.slice(8, 10)),
    Number(stamp.slice(10, 12)),
    Number(stamp.slice(12, 14)),
  )
}

describe('migrations-journal (drizzle-orm 0.x)', () => {
  it('uma entrada por pasta v1, na mesma ordem, com o SQL idêntico byte a byte', () => {
    const folders = migrationNames()
    const entries = journalEntries()

    expect(entries.map((entry) => entry.idx)).toEqual(folders.map((_, index) => index))
    folders.forEach((folder, index) => {
      const entry = entries[index]!
      expect(entry.tag).toBe(`${String(index).padStart(4, '0')}_${folder.slice(15)}`)
      expect(entry.breakpoints).toBe(true)
      const v1 = readFileSync(join(MIGRATIONS_DIR, folder, 'migration.sql'))
      const journal = readFileSync(join(JOURNAL_DIR, `${entry.tag}.sql`))
      expect(journal.equals(v1)).toBe(true)
    })
  })

  it('o `when` é o timestamp UTC do nome da pasta v1 — o `created_at` que o migrator 1.x grava', () => {
    const folders = migrationNames()
    journalEntries().forEach((entry, index) => {
      expect(entry.when).toBe(folderMillis(folders[index]!))
    })
  })

  it('não há SQL solto fora do journal — o migrator 0.x ignoraria o arquivo em silêncio', () => {
    const tags = new Set(journalEntries().map((entry) => `${entry.tag}.sql`))
    const files = readdirSync(JOURNAL_DIR).filter((name) => name.endsWith('.sql'))
    expect(files.sort()).toEqual([...tags].sort())
  })

  it('o build copia as duas pastas para o dist', () => {
    const config = readFileSync(join(__dirname, '..', 'tsup.config.ts'), 'utf8')
    expect(config).toContain('src/migrations/*')
    expect(config).toContain('src/migrations-journal/*')
  })
})

describe('runMetaWhatsAppMigrations — escolha do formato', () => {
  type MigrateCall = { readonly migrationsFolder: string; readonly migrationsTable?: string }

  function recordingMigrate(refuseFolder?: (folder: string) => Error | undefined) {
    const calls: MigrateCall[] = []
    const migrate = async (_db: never, config: MigrateCall): Promise<void> => {
      calls.push(config)
      const refusal = refuseFolder?.(config.migrationsFolder)
      if (refusal) throw refusal
    }
    return { calls, migrate }
  }

  it('sem `layout`, usa a pasta v1 — o comportamento de sempre para quem já consome', async () => {
    const { calls, migrate } = recordingMigrate()
    await runMetaWhatsAppMigrations({ db: {} as never, migrate })
    expect(calls).toEqual([
      { migrationsFolder: metaWhatsAppMigrationsFolder(), migrationsTable: META_WHATSAPP_MIGRATIONS_TABLE },
    ])
    expect(metaWhatsAppMigrationsFolder()).toBe(MIGRATIONS_DIR)
  })

  it('sem `layout`, cai para o journal quando o migrator 0.x recusa a pasta sem journal', async () => {
    const { calls, migrate } = recordingMigrate((folder) =>
      folder === MIGRATIONS_DIR ? new Error("Can't find meta/_journal.json file") : undefined,
    )
    await runMetaWhatsAppMigrations({ db: {} as never, migrate })
    expect(calls.map((call) => call.migrationsFolder)).toEqual([MIGRATIONS_DIR, JOURNAL_DIR])
  })

  it('erro que não é a recusa do formato sobe sem tentar o outro', async () => {
    const { calls, migrate } = recordingMigrate(() => new Error('connection refused'))
    await expect(runMetaWhatsAppMigrations({ db: {} as never, migrate })).rejects.toThrow('connection refused')
    expect(calls).toHaveLength(1)
  })

  it('`layout: journal` vai direto à pasta do journal', async () => {
    const { calls, migrate } = recordingMigrate()
    await runMetaWhatsAppMigrations({ db: {} as never, migrate, layout: 'journal' })
    expect(calls.map((call) => call.migrationsFolder)).toEqual([JOURNAL_DIR])
    expect(metaWhatsAppMigrationsFolder({ layout: 'journal' })).toBe(JOURNAL_DIR)
  })
})
