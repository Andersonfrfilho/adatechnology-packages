import { join } from 'node:path'
import { migrate } from 'drizzle-orm/bun-sql/migrator'
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres'
import type { AnyRelations, EmptyRelations } from 'drizzle-orm/relations'

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
export async function runMetaWhatsAppMigrations<TRelations extends AnyRelations = EmptyRelations>(
  db: BunSQLDatabase<TRelations>,
): Promise<void> {
  await migrate(db, {
    migrationsFolder: join(__dirname, 'migrations'),
    migrationsTable: 'meta_whatsapp_migrations',
  })
}
