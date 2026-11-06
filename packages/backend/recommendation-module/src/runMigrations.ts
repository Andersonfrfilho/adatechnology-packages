/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { join } from 'node:path'

import type { RecommendationDatabase } from './database.types'

// Migrations append-only com journal próprio — nunca colide com as migrations do host.
//
// O journal vive em `drizzle.recommendation_migrations` (schema `drizzle`, o padrão do
// drizzle-kit; o nome DA TABELA é que isola o módulo). Deliberadamente NÃO fica dentro de
// `recommendation`: a primeira migration do módulo é quem cria esse schema (CREATE SCHEMA), e
// apontar o journal para lá geraria uma corrida entre o migrator garantindo o schema da tabela
// de controle e a migration tentando criá-lo de novo — o mesmo raciocínio documentado em
// `meta-whatsapp-module/runMigrations.ts`.
export const RECOMMENDATION_MIGRATIONS_TABLE = 'recommendation_migrations'

// Pasta das migrations embarcadas, para o host que prefere chamar o próprio migrator.
export function recommendationMigrationsFolder(): string {
  return join(__dirname, 'migrations')
}

export type RunRecommendationMigrationsParams = {
  readonly db: RecommendationDatabase
  // O `migrate` do driver do host — `drizzle-orm/node-postgres/migrator`,
  // `drizzle-orm/bun-sql/migrator`, etc. O módulo não escolhe driver pelo host.
  readonly migrate: (db: never, config: { migrationsFolder: string; migrationsTable?: string }) => Promise<void>
}

export async function runRecommendationMigrations(params: RunRecommendationMigrationsParams): Promise<void> {
  await params.migrate(params.db as never, {
    migrationsFolder: recommendationMigrationsFolder(),
    migrationsTable: RECOMMENDATION_MIGRATIONS_TABLE,
  })
}
