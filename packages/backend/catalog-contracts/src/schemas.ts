/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Validação de fronteira. Regra que atravessa todos: **`companyId` nunca vem do corpo da
 * requisição** — é derivado do contexto autenticado (`database.md`, "Consistência e
 * multiempresa"). Aceitá-lo aqui entregaria o isolamento multiempresa ao cliente.
 */

import { z } from 'zod'

import { availabilityScheduleSchema } from './availabilitySchedule'
import { PRODUCT_SYNC_STATUS } from './catalog.types'

const MAX_PAGE_SIZE = 100
const MAX_PRICE_IN_CENTS = 100_000_000 // R$ 1.000.000,00 — teto de sanidade, não regra de negócio

/** Centavos: inteiro não-negativo. `.int()` é o que impede `19.99` virar preço por engano. */
const priceInCents = z.number().int().min(0).max(MAX_PRICE_IN_CENTS)

/** GTIN-8/12/13/14 — só dígitos. O dígito verificador é validado no use-case, não aqui. */
const MAX_ATTRIBUTES_BYTES = 16_384

/** Objeto livre do host, com teto de tamanho: vira coluna jsonb lida em toda listagem. */
export const productAttributesSchema = z
  .record(z.unknown())
  .refine((value) => JSON.stringify(value).length <= MAX_ATTRIBUTES_BYTES, 'attributes grande demais')

const barcode = z.string().regex(/^\d{8}$|^\d{12,14}$/)

export const createProductSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  // `null` = preço sob consulta.
  priceInCents: priceInCents.nullable(),
  costPriceInCents: priceInCents.optional(),
  unit: z.string().min(1).max(16).optional(),
  brand: z.string().min(1).max(80).optional(),
  unitSize: z.string().min(1).max(24).optional(),
  aisle: z.string().min(1).max(60).optional(),
  // Teto no numero e no tamanho: `aliases` alimenta um indice GIN e vem de formulario, entao sem
  // limite uma linha so poderia inchar o indice da tabela inteira.
  aliases: z.array(z.string().min(1).max(60)).max(20).optional(),
  barcode: barcode.optional(),
  catalogId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  imageUrl: z.string().url().max(2048).optional(),
  inventory: z.number().int().min(0).optional(),
  preparationTimeMinutes: z.number().int().min(0).max(1440).optional(),
  preparationInstructions: z.string().max(2000).optional(),
  sortOrder: z.number().int().optional(),
  availabilitySchedule: availabilityScheduleSchema.nullable().optional(),
  attributes: productAttributesSchema.optional(),
})
export type CreateProductBody = z.infer<typeof createProductSchema>

export const updateProductSchema = createProductSchema.partial().extend({
  active: z.boolean().optional(),
})
export type UpdateProductBody = z.infer<typeof updateProductSchema>

export const createCatalogSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  sortOrder: z.number().int().optional(),
})
export type CreateCatalogBody = z.infer<typeof createCatalogSchema>

export const updateCatalogSchema = createCatalogSchema.partial().extend({
  active: z.boolean().optional(),
})
export type UpdateCatalogBody = z.infer<typeof updateCatalogSchema>

export const createSectionSchema = z.object({
  name: z.string().min(1).max(80),
  catalogId: z.string().uuid().optional(),
  sortOrder: z.number().int().optional(),
})
export type CreateSectionBody = z.infer<typeof createSectionSchema>

export const updateSectionSchema = createSectionSchema.partial()
export type UpdateSectionBody = z.infer<typeof updateSectionSchema>

/** Query string chega sempre como texto — daí `coerce` e booleano por literal. */
const booleanFromQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional()

/** Lista separada por vírgula (`a,b,c`) → vetor sem vazios; no máximo `MAX_FILTER_VALUES` valores. */
const MAX_FILTER_VALUES = 50
const csvFromQuery = z
  .string()
  .max(2000)
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== ''),
  )
  .refine((values) => values.length <= MAX_FILTER_VALUES, 'filtro com valores demais')
  .optional()

/** Colunas ordenáveis da lista de produtos. Fora desta lista a ordem é a de exibição ao cliente. */
export const PRODUCT_SORT_FIELD = {
  NAME: 'name',
  PRICE: 'price',
  CATALOG: 'catalog',
  SECTION: 'section',
  ACTIVE: 'active',
  SORT_ORDER: 'sortOrder',
} as const
export type ProductSortField = (typeof PRODUCT_SORT_FIELD)[keyof typeof PRODUCT_SORT_FIELD]

/** Valor reservado em `catalogIds`/`sectionIds` para "sem catálogo" / "sem seção". */
export const PRODUCT_FILTER_NONE = 'none'

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  search: z.string().min(1).max(160).optional(),
  catalogId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  active: booleanFromQuery,
  syncStatus: z.nativeEnum(PRODUCT_SYNC_STATUS).optional(),
  // Opt-in: filtros de seleção múltipla, ordenação e preço sob consulta. Ausentes, a lista é a de sempre.
  catalogIds: csvFromQuery,
  sectionIds: csvFromQuery,
  priceOnRequest: booleanFromQuery,
  sortBy: z.nativeEnum(PRODUCT_SORT_FIELD).optional(),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
})
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>

/** `at` ausente = agora. ISO 8601 com offset ou `Z`. */
export const availableProductsQuerySchema = z.object({
  at: z.string().datetime({ offset: true }).optional(),
  catalogId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
})
export type AvailableProductsQuery = z.infer<typeof availableProductsQuerySchema>

export const listCatalogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  search: z.string().min(1).max(120).optional(),
  active: booleanFromQuery,
})
export type ListCatalogsQuery = z.infer<typeof listCatalogsQuerySchema>

/**
 * Uma linha da importação em lote. Aceita preço como string porque planilha exporta
 * `"19,90"` — a conversão para centavos acontece no use-case, que sabe a moeda e o locale.
 */
export const bulkImportRowSchema = z.object({
  name: z.string().min(1).max(160),
  price: z.union([z.string(), z.number()]),
  description: z.string().max(2000).optional(),
  unit: z.string().max(16).optional(),
  brand: z.string().max(80).optional(),
  unitSize: z.string().max(24).optional(),
  aisle: z.string().max(60).optional(),
  barcode: z.string().max(14).optional(),
  catalogName: z.string().max(120).optional(),
  sectionName: z.string().max(80).optional(),
  inventory: z.union([z.string(), z.number()]).optional(),
})
export type BulkImportRow = z.infer<typeof bulkImportRowSchema>
