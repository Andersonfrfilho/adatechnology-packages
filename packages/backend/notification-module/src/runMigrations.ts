/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { join } from 'node:path'

import type { NotificationDatabase } from './database.types'

// Migrations append-only com journal próprio — nunca colide com as migrations do host.
//
// O journal vive em `drizzle.notification_migrations` (schema `drizzle`, o padrão do
// drizzle-kit; o nome DA TABELA é que isola o módulo). Deliberadamente NÃO fica dentro de
// `notification`: a primeira migration do módulo é quem cria esse schema (CREATE SCHEMA), e
// apontar o journal para lá geraria uma corrida entre o migrator garantindo o schema da tabela
// de controle e a migration tentando criá-lo de novo — o mesmo raciocínio documentado em
// `meta-whatsapp-module/runMigrations.ts`.
export const NOTIFICATION_MIGRATIONS_TABLE = 'notification_migrations'

// O módulo publica as MESMAS migrations em dois formatos, porque os migrators do drizzle-orm não
// se entendem:
//   - `journal` (`migrations/`): `meta/_journal.json` do drizzle-kit 0.31; o migrator do
//     drizzle-orm 0.x exige o journal e decide "já aplicada" pelo timestamp.
//   - `v1` (`migrations-v1/`): uma pasta `<timestamp>_<nome>/migration.sql` por migration; o
//     migrator do drizzle-orm 1.x recusa pasta com journal e decide "já aplicada" pelo NOME da
//     pasta (por isso os nomes da 0.1.0-rc.3 foram mantidos).
// Hosts com drizzle-orm 1.x devem passar `layout: 'v1'`.
export type NotificationMigrationsLayout = 'journal' | 'v1'

const LAYOUT_DIRECTORY: Record<NotificationMigrationsLayout, string> = {
  journal: 'migrations',
  v1: 'migrations-v1',
}

// Pasta das migrations embarcadas, para o host que prefere chamar o próprio migrator.
export function notificationMigrationsFolder(params: { readonly layout?: NotificationMigrationsLayout } = {}): string {
  return join(__dirname, LAYOUT_DIRECTORY[params.layout ?? 'journal'])
}

export type RunNotificationMigrationsParams = {
  readonly db: NotificationDatabase
  // O `migrate` do driver do host — `drizzle-orm/node-postgres/migrator`,
  // `drizzle-orm/bun-sql/migrator`, etc. O módulo não escolhe driver pelo host.
  readonly migrate: (db: never, config: { migrationsFolder: string; migrationsTable?: string }) => Promise<void>
  // Formato das migrations. Hosts com drizzle-orm 1.x devem passar `'v1'`; omitido, tenta
  // `journal` e cai para `v1` se o migrator recusar o journal.
  readonly layout?: NotificationMigrationsLayout
}

// Mensagem do migrator 1.x ao receber pasta com journal; a recusa vem ANTES de qualquer SQL.
const OLD_FOLDER_REFUSAL = 'old drizzle-kit migration folders'

export async function runNotificationMigrations(params: RunNotificationMigrationsParams): Promise<void> {
  const run = (layout: NotificationMigrationsLayout) =>
    params.migrate(params.db as never, {
      migrationsFolder: notificationMigrationsFolder({ layout }),
      migrationsTable: NOTIFICATION_MIGRATIONS_TABLE,
    })

  if (params.layout) return run(params.layout)

  // Sem `layout`, tenta o journal e cai para o v1 se for um migrator 1.x. Sem efeito colateral:
  // a recusa acontece antes de qualquer SQL.
  try {
    await run('journal')
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes(OLD_FOLDER_REFUSAL)) throw error
    await run('v1')
  }
}
