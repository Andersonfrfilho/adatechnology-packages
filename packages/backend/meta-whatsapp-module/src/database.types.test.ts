/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Teste de tipo (o `tsc --noEmit` do pacote é quem reprova): a conexão de um host em drizzle-orm
 * 0.x é aceita, e só ela. `drizzle-orm-legacy` é o 0.45 instalado como alias só para este teste.
 */

import { describe, expect, it } from 'bun:test'
import type { NodePgDatabase as LegacyNodePgDatabase } from 'drizzle-orm-legacy/node-postgres'
import type { PostgresJsDatabase as LegacyPostgresJsDatabase } from 'drizzle-orm-legacy/postgres-js'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { MetaWhatsAppDatabase, MetaWhatsAppDatabaseFor, MetaWhatsAppDatabaseShape } from './database.types'

// Em 0.x o `PgAsyncDatabase` não existe e o import vira `any`: é o que o host em 0.x enxerga.
type DatabaseOnLegacyHost = MetaWhatsAppDatabaseFor<any>

type Accepts<TTarget, TCandidate> = TCandidate extends TTarget ? true : false
const assertType = <TCondition extends true>(): TCondition | undefined => undefined

assertType<Accepts<DatabaseOnLegacyHost, LegacyNodePgDatabase>>()
assertType<Accepts<DatabaseOnLegacyHost, LegacyPostgresJsDatabase>>()
assertType<Accepts<MetaWhatsAppDatabase, NodePgDatabase>>()
// Em 1.x o tipo continua o exato do drizzle (com `$with`, `query`...), não a forma mínima.
assertType<Accepts<{ readonly $with: unknown }, MetaWhatsAppDatabase>>()
assertType<Accepts<MetaWhatsAppDatabaseShape, MetaWhatsAppDatabase>>()

const legacyHostDatabase = {} as LegacyNodePgDatabase
const acceptedOnLegacy: DatabaseOnLegacyHost = legacyHostDatabase
// @ts-expect-error — um Pool do pg (ou qualquer objeto sem o query builder) não é conexão Drizzle.
const rejectedPool: DatabaseOnLegacyHost = { query: async () => ({ rows: [] }), connect: async () => undefined }

describe('MetaWhatsAppDatabase', () => {
  it('compiles the drizzle 0.x and 1.x assignments above', () => {
    expect([acceptedOnLegacy, rejectedPool]).toHaveLength(2)
  })
})
