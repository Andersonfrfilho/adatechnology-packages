/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { createDrizzleProvider } from './index'

const databaseUrl = process.env.DRIZZLE_TEST_DATABASE_URL ?? process.env.DATABASE_URL
const testWhenDatabaseAvailable = databaseUrl === undefined ? test.skip : test
const providers: Array<ReturnType<typeof createDrizzleProvider>> = []

function assertDefaultRelationTyping(): void {
  const providerWithoutRelations = createDrizzleProvider({
    connection: 'postgresql://localhost/database',
  })
  // @ts-expect-error EmptyRelations must not expose arbitrary relational queries.
  void providerWithoutRelations.db.query.unconfiguredRelation
}
void assertDefaultRelationTyping

afterEach(async () => {
  await Promise.all(providers.splice(0).map((provider) => provider.close()))
})

describe('createDrizzleProvider', () => {
  test('rejects non-PostgreSQL connection URLs', () => {
    expect(() => createDrizzleProvider({ connection: 'mysql://localhost/database' })).toThrow(
      'Bun SQL connection must use postgres:// or postgresql://',
    )
    expect(() => createDrizzleProvider({ connection: 'not-a-url' })).toThrow(
      'Bun SQL connection must be a valid PostgreSQL URL',
    )
  })

  testWhenDatabaseAvailable('checks PostgreSQL health', async () => {
    const provider = createDrizzleProvider({ connection: { url: databaseUrl!, max: 1 } })
    providers.push(provider)

    await expect(provider.healthCheck()).resolves.toEqual({ healthy: true })
  })

  testWhenDatabaseAvailable('rolls back a transaction', async () => {
    const provider = createDrizzleProvider({ connection: { url: databaseUrl!, max: 1 } })
    providers.push(provider)
    const marker = crypto.randomUUID()

    await expect(
      provider.db.transaction(async (transaction) => {
        await transaction.execute(sql`create temporary table drizzle_provider_test (marker text)`)
        await transaction.execute(sql`insert into drizzle_provider_test (marker) values (${marker})`)
        throw new Error('force transaction rollback')
      }),
    ).rejects.toThrow('force transaction rollback')

    const result = await provider.db.execute(sql`select to_regclass('pg_temp.drizzle_provider_test') as relation`)
    expect(result[0]?.relation).toBeNull()
  })

  testWhenDatabaseAvailable('closes idempotently', async () => {
    const provider = createDrizzleProvider({ connection: { url: databaseUrl!, max: 1 } })

    await provider.healthCheck()
    const inFlightQuery = Promise.resolve(provider.db.execute(sql`select pg_sleep(0.05)`))
    await Bun.sleep(5)
    const firstClose = provider.close()
    const secondClose = provider.close()

    expect(firstClose).toBe(secondClose)
    await expect(inFlightQuery).resolves.toBeDefined()
    await expect(firstClose).resolves.toBeUndefined()
    await expect(provider.healthCheck()).rejects.toThrow()
  })
})
