import { join } from 'node:path'
import { migrate } from 'drizzle-orm/bun-sql/migrator'
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres'
import type { AnyRelations, EmptyRelations } from 'drizzle-orm/relations'

// Migrations append-only com journal próprio (tabela meta_whatsapp_migrations) — nunca colide
// com as migrations do host, que roda as delas por um caminho totalmente separado (ver
// rules/packages/pluggable-module.md §3.2). O journal fica no schema padrão (public), não dentro
// de meta_whatsapp: a primeira migration do módulo é justamente quem cria o schema meta_whatsapp
// (CREATE SCHEMA), então colocar o journal ali dentro criaria uma corrida entre o migrator
// garantindo o schema para a tabela de controle e a própria migration tentando criá-lo de novo.
export async function runMetaWhatsAppMigrations<TRelations extends AnyRelations = EmptyRelations>(
  db: BunSQLDatabase<TRelations>,
): Promise<void> {
  await migrate(db, {
    migrationsFolder: join(__dirname, 'migrations'),
    migrationsTable: 'meta_whatsapp_migrations',
  })
}
