/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Regenera `src/migrations-journal/` (formato do drizzle-orm 0.x) a partir de `src/migrations/`
 * (formato do drizzle-orm 1.x), que é a fonte. Rodar depois de todo `db:generate`:
 *
 *   bun scripts/generate-journal-migrations.ts
 *
 * O SQL é copiado byte a byte e o `when` de cada entrada é o timestamp do nome da pasta em UTC — o
 * mesmo valor que o migrator 1.x grava em `created_at`, para os dois migrators concordarem sobre o
 * que já foi aplicado. `migrations.test.ts` reprova o pacote se as duas pastas divergirem.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE_DIR = join(import.meta.dir, '..', 'src', 'migrations')
const TARGET_DIR = join(import.meta.dir, '..', 'src', 'migrations-journal')

function folderTimestampToMillis(folderName: string): number {
  const stamp = folderName.slice(0, 14)
  return Date.UTC(
    Number(stamp.slice(0, 4)),
    Number(stamp.slice(4, 6)) - 1,
    Number(stamp.slice(6, 8)),
    Number(stamp.slice(8, 10)),
    Number(stamp.slice(10, 12)),
    Number(stamp.slice(12, 14)),
  )
}

const folders = readdirSync(SOURCE_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

rmSync(TARGET_DIR, { recursive: true, force: true })
mkdirSync(join(TARGET_DIR, 'meta'), { recursive: true })

const entries = folders.map((folder, index) => {
  const tag = `${String(index).padStart(4, '0')}_${folder.slice(15)}`
  writeFileSync(join(TARGET_DIR, `${tag}.sql`), readFileSync(join(SOURCE_DIR, folder, 'migration.sql')))
  return { idx: index, version: '7', when: folderTimestampToMillis(folder), tag, breakpoints: true }
})

writeFileSync(
  join(TARGET_DIR, 'meta', '_journal.json'),
  `${JSON.stringify({ version: '7', dialect: 'postgresql', entries }, null, 2)}\n`,
)
