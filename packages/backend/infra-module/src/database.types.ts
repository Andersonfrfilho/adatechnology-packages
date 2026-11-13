/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

// Tipo genérico do pg-core: o módulo só usa o query builder, e amarrá-lo a um driver excluiria hosts
// em outro driver (mesmo desenho de `scheduling-module`).
export type InfraDatabase = PgDatabase<PgQueryResultHKT, any, any>
