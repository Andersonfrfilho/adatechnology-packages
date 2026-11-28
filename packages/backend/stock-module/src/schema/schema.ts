/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Tudo de um insumo (nível, lotes, movimentos) fica na unidade gravada no nível quando ele nasceu;
 * a leitura converte para a unidade atual do insumo. Quantidade em numeric(14,4), exata.
 */

import { sql } from 'drizzle-orm'
import {
  check,
  index,
  numeric,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const stockSchema = pgSchema('stock')

export const levels = stockSchema.table(
  'levels',
  {
    companyId: uuid('company_id').notNull(),
    ingredientId: uuid('ingredient_id').notNull(),
    unit: varchar('unit', { length: 8 }).notNull(),
    quantity: numeric('quantity', { precision: 14, scale: 4 }).notNull().default('0'),
    minimumQuantity: numeric('minimum_quantity', { precision: 14, scale: 4 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.companyId, table.ingredientId] }),
    check('levels_minimum_not_negative', sql`"minimum_quantity" is null or "minimum_quantity" >= 0`),
  ],
)

export const batches = stockSchema.table(
  'batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    ingredientId: uuid('ingredient_id').notNull(),
    batchCode: varchar('batch_code', { length: 100 }).notNull(),
    unit: varchar('unit', { length: 8 }).notNull(),
    quantity: numeric('quantity', { precision: 14, scale: 4 }).notNull(),
    remainingQuantity: numeric('remaining_quantity', { precision: 14, scale: 4 }).notNull(),
    costPerUnit: numeric('cost_per_unit', { precision: 14, scale: 4 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_batches_ingredient_expiry').on(table.companyId, table.ingredientId, table.expiresAt),
    // Varredura diária de validade: só lote com saldo.
    index('idx_batches_expiring')
      .on(table.expiresAt)
      .where(sql`"remaining_quantity" > 0 and "expires_at" is not null`),
    check('batches_quantity_positive', sql`"quantity" > 0`),
    check('batches_remaining_range', sql`"remaining_quantity" >= 0 and "remaining_quantity" <= "quantity"`),
  ],
)

export const movements = stockSchema.table(
  'movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    ingredientId: uuid('ingredient_id').notNull(),
    batchId: uuid('batch_id').references(() => batches.id, { onDelete: 'set null' }),
    kind: varchar('kind', { length: 10 }).notNull(),
    delta: numeric('delta', { precision: 14, scale: 4 }).notNull(),
    unit: varchar('unit', { length: 8 }).notNull(),
    reason: varchar('reason', { length: 255 }).notNull(),
    actorId: varchar('actor_id', { length: 128 }),
    sourceKey: varchar('source_key', { length: 300 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_movements_company_created').on(table.companyId, table.createdAt),
    index('idx_movements_ingredient_created').on(table.companyId, table.ingredientId, table.createdAt),
    check('movements_delta_not_zero', sql`"delta" <> 0`),
  ],
)

/** Uma linha por chave de origem já baixada: a PK decide a corrida entre duas baixas iguais. */
export const deductions = stockSchema.table(
  'deductions',
  {
    companyId: uuid('company_id').notNull(),
    sourceKey: varchar('source_key', { length: 300 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.companyId, table.sourceKey] })],
)

export const inventoryCounts = stockSchema.table(
  'inventory_counts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    status: varchar('status', { length: 10 }).notNull().default('open'),
    note: text('note').notNull().default(''),
    actorId: varchar('actor_id', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_inventory_counts_company_created').on(table.companyId, table.createdAt),
    // Um inventário aberto por empresa: dois aplicariam o mesmo ajuste duas vezes.
    uniqueIndex('uq_inventory_counts_open')
      .on(table.companyId)
      .where(sql`"status" = 'open'`),
  ],
)

export const inventoryCountLines = stockSchema.table(
  'inventory_count_lines',
  {
    countId: uuid('count_id')
      .notNull()
      .references(() => inventoryCounts.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id').notNull(),
    ingredientId: uuid('ingredient_id').notNull(),
    unit: varchar('unit', { length: 8 }).notNull(),
    expectedQuantity: numeric('expected_quantity', { precision: 14, scale: 4 }).notNull(),
    countedQuantity: numeric('counted_quantity', { precision: 14, scale: 4 }),
  },
  (table) => [
    primaryKey({ columns: [table.countId, table.ingredientId] }),
    check('inventory_lines_counted_not_negative', sql`"counted_quantity" is null or "counted_quantity" >= 0`),
  ],
)

export type LevelRow = typeof levels.$inferSelect
export type BatchRow = typeof batches.$inferSelect
export type NewBatchRow = typeof batches.$inferInsert
export type MovementRow = typeof movements.$inferSelect
export type NewMovementRow = typeof movements.$inferInsert
export type InventoryCountRow = typeof inventoryCounts.$inferSelect
export type InventoryCountLineRow = typeof inventoryCountLines.$inferSelect
