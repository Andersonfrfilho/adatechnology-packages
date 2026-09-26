/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { join } from 'node:path'

import type { ConversationDatabase } from './database.types'

// Migrations append-only com journal próprio — nunca colide com as migrations do host. Mesmo
// desenho de `notification-module/runMigrations.ts`: o journal fica no schema `drizzle` (padrão do
// drizzle-kit), nunca dentro de `conversation` — é a primeira migration do módulo que cria esse
// schema, e apontar o journal para lá geraria corrida entre o migrator garantindo o schema da
// tabela de controle e a migration tentando criá-lo de novo.
export const CONVERSATION_MIGRATIONS_TABLE = 'conversation_migrations'

// Pasta das migrations embarcadas, para o host que prefere chamar o próprio migrator.
export function conversationMigrationsFolder(): string {
  return join(__dirname, 'migrations')
}

export type RunConversationMigrationsParams = {
  readonly db: ConversationDatabase
  // O `migrate` do conector do host — `drizzle-orm/node-postgres/migrator`,
  // `drizzle-orm/bun-sql/migrator`, etc. O módulo não escolhe conector pelo host.
  readonly migrate: (db: never, config: { migrationsFolder: string; migrationsTable?: string }) => Promise<void>
}

export async function runConversationMigrations(params: RunConversationMigrationsParams): Promise<void> {
  await params.migrate(params.db as never, {
    migrationsFolder: conversationMigrationsFolder(),
    migrationsTable: CONVERSATION_MIGRATIONS_TABLE,
  })
}
