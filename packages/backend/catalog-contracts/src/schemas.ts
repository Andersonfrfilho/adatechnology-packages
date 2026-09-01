/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Validação de fronteira. Regra que atravessa todos: **`companyId` nunca vem do corpo da
 * requisição** — é derivado do contexto autenticado (`database.md`, "Consistência e
 * multiempresa"). Aceitá-lo aqui entregaria o isolamento multiempresa ao cliente.
 */

import { z } from 'zod'

import { PRODUCT_SYNC_STATUS } from './catalog.types'

const MAX_PAGE_SIZE = 100
const MAX_PRICE_IN_CENTS = 100_000_000 // R$ 1.000.000,00 — teto de sanidade, não regra de negócio

/** Centavos: inteiro não-negativo. `.int()` é o que impede `19.99` virar preço por engano. */
const priceInCents = z.number().int().min(0).max(MAX_PRICE_IN_CENTS)

/** GTIN-8/12/13/14 — só dígitos. O dígito verificador é validado no use-case, não aqui. */
const barcode = z.string().regex(/^\d{8}$|^\d{12,14}$/)

export const createProductSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  priceInCents,
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

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  search: z.string().min(1).max(160).optional(),
  catalogId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  active: booleanFromQuery,
  syncStatus: z.nativeEnum(PRODUCT_SYNC_STATUS).optional(),
})
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>

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
