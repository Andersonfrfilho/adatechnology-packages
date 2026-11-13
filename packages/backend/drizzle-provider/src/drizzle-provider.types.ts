/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import type { SQL } from 'bun'
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres'
import type { AnyRelations, EmptyRelations } from 'drizzle-orm/relations'

export type BunPostgresConnectionOptions = Omit<SQL.PostgresOrMySQLOptions, 'adapter'> & {
  readonly adapter?: 'postgres'
}

export type BunSqlConnectionConfig = string | URL | BunPostgresConnectionOptions

export type DrizzleProviderConfig<TRelations extends AnyRelations = EmptyRelations> = {
  readonly connection: BunSqlConnectionConfig
  readonly relations?: TRelations
}

export type DrizzleProviderHealth = {
  readonly healthy: true
}

export type DrizzleProvider<TRelations extends AnyRelations = EmptyRelations> = {
  readonly db: BunSQLDatabase<TRelations>
  healthCheck(): Promise<DrizzleProviderHealth>
  close(): Promise<void>
}
