/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  decimalSchema,
  positiveDecimalSchema,
  productIdSchema,
  RECIPE_UNITS,
  type RecipeUnit,
} from '@adatechnology/recipe-contracts'
import { z } from 'zod'

import { MOVEMENT_KINDS, type MovementKind } from './stock.types'

export const STOCK_LIMITS = {
  REASON: 255,
  BATCH_CODE: 100,
  NOTE: 1000,
  PAGE_SIZE: 100,
  ORDER_LINES: 500,
  LINE_KEY: 128,
  INVENTORY_LINES: 2000,
  EXPIRY_DAYS: 365,
} as const

const unitSchema = z.enum(RECIPE_UNITS as [RecipeUnit, ...RecipeUnit[]])
const reasonSchema = z.string().trim().min(1).max(STOCK_LIMITS.REASON)
const pageShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(STOCK_LIMITS.PAGE_SIZE).default(20),
}

export const receiveBatchSchema = z.object({
  ingredientId: z.string().uuid(),
  quantity: positiveDecimalSchema,
  /** Ausente: unidade do insumo. Compatível é convertida (recebeu 5 kg de um insumo em g). */
  unit: unitSchema.optional(),
  batchCode: z.string().trim().min(1).max(STOCK_LIMITS.BATCH_CODE),
  costPerUnit: decimalSchema.nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  reason: z.string().trim().max(STOCK_LIMITS.REASON).optional(),
})
export type ReceiveBatchInput = z.input<typeof receiveBatchSchema>
export type ReceiveBatchData = z.output<typeof receiveBatchSchema>

export const ADJUST_DIRECTION = { INCREASE: 'increase', DECREASE: 'decrease' } as const
export type AdjustDirection = (typeof ADJUST_DIRECTION)[keyof typeof ADJUST_DIRECTION]

export const adjustStockSchema = z.object({
  ingredientId: z.string().uuid(),
  direction: z.enum([ADJUST_DIRECTION.INCREASE, ADJUST_DIRECTION.DECREASE]),
  quantity: positiveDecimalSchema,
  unit: unitSchema.optional(),
  reason: reasonSchema,
})
export type AdjustStockInput = z.input<typeof adjustStockSchema>
export type AdjustStockData = z.output<typeof adjustStockSchema>

export const recordLossSchema = z.object({
  ingredientId: z.string().uuid(),
  quantity: positiveDecimalSchema,
  unit: unitSchema.optional(),
  /** Perda de um lote certo (venceu); sem lote, sai dos que vencem antes. */
  batchId: z.string().uuid().optional(),
  reason: reasonSchema,
})
export type RecordLossInput = z.input<typeof recordLossSchema>
export type RecordLossData = z.output<typeof recordLossSchema>

export const setMinimumSchema = z.object({ minimumQuantity: decimalSchema.nullable() })
export type SetMinimumData = z.output<typeof setMinimumSchema>

export const orderLineSchema = z.object({
  /** Estável por linha do pedido (id do item): a mesma chave nunca baixa duas vezes. */
  lineKey: z.string().trim().min(1).max(STOCK_LIMITS.LINE_KEY),
  productId: productIdSchema,
  quantity: positiveDecimalSchema,
})

export const deductOrderSchema = z.object({
  orderId: z.string().trim().min(1).max(STOCK_LIMITS.LINE_KEY),
  lines: z.array(orderLineSchema).min(1).max(STOCK_LIMITS.ORDER_LINES),
})
export type DeductOrderInput = z.input<typeof deductOrderSchema>
export type DeductOrderData = z.output<typeof deductOrderSchema>

export const listLevelsQuerySchema = z.object({
  ...pageShape,
  belowMinimum: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
})
export type ListLevelsQuery = z.output<typeof listLevelsQuerySchema>

function csvKinds() {
  return z
    .string()
    .trim()
    .min(1)
    .max(100)
    .transform((raw) => raw.split(',').map((value) => value.trim()))
    .refine((list): list is MovementKind[] =>
      list.every((value) => (MOVEMENT_KINDS as readonly string[]).includes(value)),
    )
    .optional()
}

export const listMovementsQuerySchema = z.object({
  ...pageShape,
  ingredientId: z.string().uuid().optional(),
  kind: csvKinds(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
})
export type ListMovementsQuery = z.output<typeof listMovementsQuerySchema>

export const listBatchesQuerySchema = z.object({
  ...pageShape,
  ingredientId: z.string().uuid().optional(),
  /** Só lotes com saldo. Padrão: sim. */
  onlyWithRemaining: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default('true'),
  expiringWithinDays: z.coerce.number().int().min(0).max(STOCK_LIMITS.EXPIRY_DAYS).optional(),
})
export type ListBatchesQuery = z.output<typeof listBatchesQuerySchema>

export const openInventorySchema = z.object({
  /** Ausente ou vazio: todos os insumos com nível na empresa. */
  ingredientIds: z.array(z.string().uuid()).max(STOCK_LIMITS.INVENTORY_LINES).optional(),
  note: z.string().trim().max(STOCK_LIMITS.NOTE).default(''),
})
export type OpenInventoryData = z.output<typeof openInventorySchema>

export const recordCountsSchema = z.object({
  counts: z
    .array(z.object({ ingredientId: z.string().uuid(), countedQuantity: decimalSchema.nullable() }))
    .min(1)
    .max(STOCK_LIMITS.INVENTORY_LINES),
})
export type RecordCountsData = z.output<typeof recordCountsSchema>

export const listInventoriesQuerySchema = z.object({ ...pageShape })
export type ListInventoriesQuery = z.output<typeof listInventoriesQuerySchema>

export const stockLevelsLookupSchema = z.object({
  ingredientIds: z.array(z.string().uuid()).min(1).max(STOCK_LIMITS.INVENTORY_LINES),
})
export type StockLevelsLookupData = z.output<typeof stockLevelsLookupSchema>
