/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Validação de fronteira. Os mesmos schemas servem a rota do módulo e o formulário do painel.
 */

import { z } from 'zod'

import { DECIMAL_PATTERN, isPositive, normalizeDecimal, parseDecimal } from './decimal'
import { RECIPE_UNITS, type RecipeUnit } from './units'

export const RECIPE_LIMITS = {
  NAME: 160,
  SUPPLIER: 160,
  NOTES: 2000,
  LINE_NOTES: 500,
  INSTRUCTIONS: 20_000,
  LINES: 200,
  SEARCH: 120,
  PAGE_SIZE: 100,
  PRODUCT_ID: 128,
  BATCH_PRODUCTS: 500,
  PREPARATION_MINUTES: 10_080,
} as const

export const EXPORT_FORMAT = { CSV: 'csv', XLSX: 'xlsx' } as const
export type ExportFormat = (typeof EXPORT_FORMAT)[keyof typeof EXPORT_FORMAT]

const unitSchema = z.enum(RECIPE_UNITS as [RecipeUnit, ...RecipeUnit[]])

/** Texto ou número; sai canônico com 4 casas. Vírgula decimal (pt-BR) é aceita. */
export const decimalSchema = z
  .union([z.string(), z.number()])
  .transform((value) => (typeof value === 'number' ? String(value) : value.trim().replace(',', '.')))
  .refine((value) => DECIMAL_PATTERN.test(value), { message: 'Até 10 dígitos e 4 casas decimais.' })
  .transform(normalizeDecimal)

export const positiveDecimalSchema = decimalSchema.refine((value) => isPositive(parseDecimal(value)), {
  message: 'Precisa ser maior que zero.',
})

/** Referência opaca do host (UUID, slug, código): sem barra nem espaço, para caber no caminho. */
export const productIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(RECIPE_LIMITS.PRODUCT_ID)
  .regex(/^[A-Za-z0-9._:-]+$/, 'Identificador de produto inválido.')

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null))

export const createIngredientSchema = z.object({
  name: z.string().trim().min(1).max(RECIPE_LIMITS.NAME),
  unit: unitSchema,
  costPerUnit: decimalSchema.default('0'),
  supplier: optionalText(RECIPE_LIMITS.SUPPLIER),
  notes: optionalText(RECIPE_LIMITS.NOTES),
})
export type CreateIngredientInput = z.input<typeof createIngredientSchema>
export type CreateIngredientData = z.output<typeof createIngredientSchema>

export const updateIngredientSchema = z
  .object({
    name: z.string().trim().min(1).max(RECIPE_LIMITS.NAME),
    unit: unitSchema,
    costPerUnit: decimalSchema,
    supplier: z.string().trim().max(RECIPE_LIMITS.SUPPLIER).nullable(),
    notes: z.string().trim().max(RECIPE_LIMITS.NOTES).nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Nada para alterar.' })
export type UpdateIngredientInput = z.input<typeof updateIngredientSchema>
export type UpdateIngredientData = z.output<typeof updateIngredientSchema>

export const INGREDIENT_SORT_FIELDS = ['name', 'unit', 'costPerUnit', 'updatedAt'] as const
export type IngredientSortField = (typeof INGREDIENT_SORT_FIELDS)[number]

/** Vários valores separados por vírgula: `unit=kg,g`. */
function csvEnum<TValue extends string>(values: readonly TValue[]) {
  return z
    .string()
    .trim()
    .min(1)
    .max(200)
    .transform((raw) => raw.split(',').map((value) => value.trim()))
    .refine((list): list is TValue[] => list.every((value) => (values as readonly string[]).includes(value)), {
      message: `Valores aceitos: ${values.join(', ')}.`,
    })
    .optional()
}

const filtersShape = {
  search: z.string().trim().min(1).max(RECIPE_LIMITS.SEARCH).optional(),
  unit: csvEnum(RECIPE_UNITS),
  sort: z.enum(INGREDIENT_SORT_FIELDS).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
}

export const listIngredientsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(RECIPE_LIMITS.PAGE_SIZE).default(20),
  ...filtersShape,
})
export type ListIngredientsQuery = z.output<typeof listIngredientsQuerySchema>

export const exportFormatSchema = z.object({ format: z.enum([EXPORT_FORMAT.CSV, EXPORT_FORMAT.XLSX]).default('csv') })

export const exportIngredientsQuerySchema = z.object(filtersShape).merge(exportFormatSchema)
export type ExportIngredientsQuery = z.output<typeof exportIngredientsQuerySchema>
export type IngredientFilters = Omit<ExportIngredientsQuery, 'format'>

export const recipeLineInputSchema = z.object({
  /** Linha existente mantém o id; sem id, nasce outra. */
  id: z.string().uuid().optional(),
  ingredientId: z.string().uuid(),
  quantity: positiveDecimalSchema,
  unit: unitSchema,
  notes: optionalText(RECIPE_LIMITS.LINE_NOTES),
})
export type RecipeLineInput = z.input<typeof recipeLineInputSchema>
export type RecipeLineData = z.output<typeof recipeLineInputSchema>

export const saveRecipeSchema = z
  .object({
    yieldPortions: positiveDecimalSchema.default('1'),
    preparationTimeMinutes: z.number().int().min(0).max(RECIPE_LIMITS.PREPARATION_MINUTES).nullable().default(null),
    instructions: z.string().max(RECIPE_LIMITS.INSTRUCTIONS).default(''),
    lines: z.array(recipeLineInputSchema).max(RECIPE_LIMITS.LINES).default([]),
  })
  .refine(
    (value) => {
      const ids = value.lines.flatMap((line) => (line.id ? [line.id] : []))
      return new Set(ids).size === ids.length
    },
    { message: 'Linha repetida.', path: ['lines'] },
  )
export type SaveRecipeInput = z.input<typeof saveRecipeSchema>
export type SaveRecipeData = z.output<typeof saveRecipeSchema>

const salePriceCentsSchema = z.number().int().min(0).max(1_000_000_000)

export const recipeQuerySchema = z.object({
  salePriceCents: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
})
export type RecipeQuery = z.output<typeof recipeQuerySchema>

export const recipeCostsSchema = z.object({
  products: z
    .array(z.object({ productId: productIdSchema, salePriceCents: salePriceCentsSchema.nullable().optional() }))
    .min(1)
    .max(RECIPE_LIMITS.BATCH_PRODUCTS),
})
export type RecipeCostsInput = z.input<typeof recipeCostsSchema>
export type RecipeCostsData = z.output<typeof recipeCostsSchema>

export const recipesLookupSchema = z.object({
  productIds: z.array(productIdSchema).min(1).max(RECIPE_LIMITS.BATCH_PRODUCTS),
})
export type RecipesLookupData = z.output<typeof recipesLookupSchema>

export const plannedItemSchema = z.object({
  productId: productIdSchema,
  /** Unidades do produto (porções) previstas: encomendas, reservas, previsão. */
  quantity: positiveDecimalSchema,
})
export type PlannedItem = z.output<typeof plannedItemSchema>

export const shoppingListSchema = z.object({
  items: z.array(plannedItemSchema).min(1).max(RECIPE_LIMITS.BATCH_PRODUCTS),
})
export type ShoppingListInput = z.input<typeof shoppingListSchema>
export type ShoppingListData = z.output<typeof shoppingListSchema>

export const shoppingListExportSchema = shoppingListSchema.merge(exportFormatSchema)
export type ShoppingListExportData = z.output<typeof shoppingListExportSchema>
