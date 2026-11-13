/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { SQL } from 'bun'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import type { AnyRelations, EmptyRelations } from 'drizzle-orm/relations'
import type {
  BunSqlConnectionConfig,
  DrizzleProvider,
  DrizzleProviderConfig,
  DrizzleProviderHealth,
} from './drizzle-provider.types'

const HEALTH_CHECK_QUERY = sql`select 1`

export function createDrizzleProvider<TRelations extends AnyRelations = EmptyRelations>(
  config: DrizzleProviderConfig<TRelations>,
): DrizzleProvider<TRelations> {
  const client = createSqlClient(config.connection)
  const db = drizzle<TRelations>({ client, relations: config.relations })
  let closePromise: Promise<void> | undefined

  return {
    db,
    async healthCheck(): Promise<DrizzleProviderHealth> {
      await db.execute(HEALTH_CHECK_QUERY)

      return { healthy: true }
    },
    close(): Promise<void> {
      closePromise ??= client.close()

      return closePromise
    },
  }
}

function createSqlClient(connection: BunSqlConnectionConfig): SQL {
  if (typeof connection === 'string' || connection instanceof URL) {
    assertPostgresUrl(connection)

    return new SQL(connection)
  }

  if (connection.adapter !== undefined && connection.adapter !== 'postgres') {
    throw new TypeError('Bun SQL adapter must be postgres')
  }
  if (connection.url !== undefined) {
    assertPostgresUrl(connection.url)
  }

  return new SQL(connection)
}

function assertPostgresUrl(connection: string | URL): void {
  let url: URL

  try {
    url = connection instanceof URL ? connection : new URL(connection)
  } catch {
    throw new TypeError('Bun SQL connection must be a valid PostgreSQL URL')
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new TypeError('Bun SQL connection must use postgres:// or postgresql://')
  }
}
