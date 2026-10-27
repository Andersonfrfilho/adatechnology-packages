/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { join } from 'node:path'

import type { CustomerDatabase } from './database.types'

// Migrations append-only com journal próprio — nunca colide com as migrations do host.
//
// O journal vive em `drizzle.customer_migrations` (schema `drizzle`, o padrão do
// drizzle-kit; o nome DA TABELA é que isola o módulo). Deliberadamente NÃO fica dentro de
// `customer`: a primeira migration do módulo é quem cria esse schema (CREATE SCHEMA), e
// apontar o journal para lá geraria uma corrida entre o migrator garantindo o schema da tabela
// de controle e a migration tentando criá-lo de novo — o mesmo raciocínio documentado em
// `meta-whatsapp-module/runMigrations.ts`.
export const CUSTOMER_MIGRATIONS_TABLE = 'customer_migrations'

// Pasta das migrations embarcadas, para o host que prefere chamar o próprio migrator.
export function customerMigrationsFolder(): string {
  return join(__dirname, 'migrations')
}

export type RunCustomerMigrationsParams = {
  readonly db: CustomerDatabase
  // O `migrate` do driver do host — `drizzle-orm/node-postgres/migrator`,
  // `drizzle-orm/bun-sql/migrator`, etc. O módulo não escolhe driver pelo host.
  readonly migrate: (db: never, config: { migrationsFolder: string; migrationsTable?: string }) => Promise<void>
}

export async function runCustomerMigrations(params: RunCustomerMigrationsParams): Promise<void> {
  await params.migrate(params.db as never, {
    migrationsFolder: customerMigrationsFolder(),
    migrationsTable: CUSTOMER_MIGRATIONS_TABLE,
  })
}
