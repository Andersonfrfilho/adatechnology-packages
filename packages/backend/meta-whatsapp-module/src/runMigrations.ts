import { join } from 'node:path'
import type { MetaWhatsAppDatabase } from './database.types'

// Migrations append-only com journal próprio — nunca colide com as migrations do host, que roda
// as delas por um caminho totalmente separado (ver rules/packages/pluggable-module.md §3.2).
//
// O journal vive em `drizzle.meta_whatsapp_migrations` (schema `drizzle`, o padrão do
// drizzle-kit; o nome DA TABELA é que isola o módulo — o host usa `__drizzle_migrations` ali do
// lado, sem conflito). Deliberadamente NÃO fica dentro de `meta_whatsapp`: a primeira migration
// do módulo é justamente quem cria esse schema (CREATE SCHEMA), então apontar o journal para lá
// gera uma corrida entre o migrator garantindo o schema da tabela de controle e a migration
// tentando criá-lo de novo — o erro "schema meta_whatsapp already exists".
//
// Para resetar um banco de teste é preciso derrubar os dois: o schema meta_whatsapp E o journal
// em drizzle.meta_whatsapp_migrations. Só dropar o schema faz o migrator pular tudo na próxima
// execução, deixando o banco sem as tabelas e sem erro aparente.
export const META_WHATSAPP_MIGRATIONS_TABLE = 'meta_whatsapp_migrations'

// O módulo publica as MESMAS migrations em dois formatos, porque os migrators do drizzle-orm não
// se entendem:
//   - `v1` (`migrations/`): uma pasta `<timestamp>_<nome>/migration.sql` por migration. O migrator do
//     drizzle-orm 1.x recusa pasta com journal e decide "já aplicada" pelo NOME da pasta. É o formato
//     original do pacote, e continua sendo o padrão.
//   - `journal` (`migrations-journal/`): `meta/_journal.json` + `<idx>_<nome>.sql`. O migrator do
//     drizzle-orm 0.x (0.36–0.45) exige o journal e decide pelo `when`, que é o timestamp do nome
//     da pasta v1 — o mesmo `created_at` que o 1.x grava.
// O SQL é idêntico byte a byte (gerado por `scripts/generate-journal-migrations.ts`).
//
// Só se sobe de versão: 0.x → 1.x. **Nunca voltar ao drizzle-orm 0.x depois de rodar com 1.x.** Os
// dois migrators escrevem na mesma tabela com critérios diferentes (1.x pelo nome da pasta, 0.x pelo
// `when` da última linha); de volta ao 0.x, uma linha gravada pelo 1.x pode fazer o 0.x reaplicar
// migration já aplicada sobre o schema existente — e migration não é idempotente.
export type MetaWhatsAppMigrationsLayout = 'v1' | 'journal'

const LAYOUT_DIRECTORY: Record<MetaWhatsAppMigrationsLayout, string> = {
  v1: 'migrations',
  journal: 'migrations-journal',
}

export type MetaWhatsAppMigrationsFolderParams = {
  readonly layout?: MetaWhatsAppMigrationsLayout
}

// Pasta das migrations embarcadas, para o host que prefere chamar o próprio migrator. Sem
// `layout`, devolve a pasta v1 — o comportamento de sempre.
export function metaWhatsAppMigrationsFolder(params: MetaWhatsAppMigrationsFolderParams = {}): string {
  return join(__dirname, LAYOUT_DIRECTORY[params.layout ?? 'v1'])
}

export type RunMetaWhatsAppMigrationsParams = {
  db: MetaWhatsAppDatabase
  // O `migrate` do driver do host — `drizzle-orm/node-postgres/migrator`,
  // `drizzle-orm/postgres-js/migrator`, `drizzle-orm/bun-sql/migrator`, etc. O módulo não escolhe
  // driver pelo host.
  migrate: (db: never, config: { migrationsFolder: string; migrationsTable?: string }) => Promise<void>
  // `'journal'` para drizzle-orm 0.x, `'v1'` para 1.x. Omitido, tenta `v1` e cai para `journal` se
  // o migrator recusar a pasta por falta de journal — a recusa vem antes de qualquer SQL.
  layout?: MetaWhatsAppMigrationsLayout
}

// Mensagem do migrator 0.x ao receber pasta sem journal (`readMigrationFiles`).
const MISSING_JOURNAL_REFUSAL = 'meta/_journal.json'

export async function runMetaWhatsAppMigrations(params: RunMetaWhatsAppMigrationsParams): Promise<void> {
  const run = (layout: MetaWhatsAppMigrationsLayout) =>
    params.migrate(params.db as never, {
      migrationsFolder: metaWhatsAppMigrationsFolder({ layout }),
      migrationsTable: META_WHATSAPP_MIGRATIONS_TABLE,
    })

  if (params.layout) return run(params.layout)

  try {
    await run('v1')
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes(MISSING_JOURNAL_REFUSAL)) throw error
    await run('journal')
  }
}
