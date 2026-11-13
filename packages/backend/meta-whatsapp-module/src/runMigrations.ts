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

// Pasta das migrations embarcadas, para o host que prefere chamar o próprio migrator.
export function metaWhatsAppMigrationsFolder(): string {
  return join(__dirname, 'migrations')
}

export type RunMetaWhatsAppMigrationsParams = {
  db: MetaWhatsAppDatabase
  // O `migrate` do driver do host — `drizzle-orm/node-postgres/migrator`,
  // `drizzle-orm/bun-sql/migrator`, etc. O módulo não escolhe driver pelo host.
  migrate: (db: never, config: { migrationsFolder: string; migrationsTable?: string }) => Promise<void>
}

export async function runMetaWhatsAppMigrations(params: RunMetaWhatsAppMigrationsParams): Promise<void> {
  await params.migrate(params.db as never, {
    migrationsFolder: metaWhatsAppMigrationsFolder(),
    migrationsTable: META_WHATSAPP_MIGRATIONS_TABLE,
  })
}
