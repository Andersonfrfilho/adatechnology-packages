/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O tipo do banco vem do host: o módulo não escolhe driver por ele.
 */

import type { PgAsyncDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

export type CustomerDatabase = PgAsyncDatabase<PgQueryResultHKT, any>
