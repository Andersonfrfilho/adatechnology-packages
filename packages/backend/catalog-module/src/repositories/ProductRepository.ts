/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, asc, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm'
import { InsufficientInventoryError } from '@adatechnology/catalog-contracts'

import type { CatalogDatabase } from '../database.types'
import { products, type NewProductRow, type ProductRow } from '../schema/schema'
import { productListCondition, productOwnedByCondition, productSearchCondition } from './conditions'

export type ListProductsQuery = {
  readonly companyId: string
  readonly page: number
  readonly pageSize: number
  readonly search?: string
  readonly catalogId?: string
  readonly sectionId?: string
  readonly active?: boolean
  readonly syncStatus?: string
}

export type ListProductsPage = {
  readonly rows: ProductRow[]
  readonly total: number
}

/**
 * Projeção **sem `costPriceInCents`** — o custo é dado de margem e não pode chegar ao cliente
 * final. É uma lista explícita, e não um `omit`, porque coluna nova nasce fora daqui por padrão:
 * esquecer de excluir vaza, esquecer de incluir só some da tela.
 */
export const CUSTOMER_FACING_PRODUCT_COLUMNS = {
  id: products.id,
  companyId: products.companyId,
  catalogId: products.catalogId,
  sectionId: products.sectionId,
  name: products.name,
  description: products.description,
  priceInCents: products.priceInCents,
  unit: products.unit,
  brand: products.brand,
  unitSize: products.unitSize,
  aisle: products.aisle,
  aliases: products.aliases,
  barcode: products.barcode,
  imageUrl: products.imageUrl,
  inventory: products.inventory,
  active: products.active,
  sortOrder: products.sortOrder,
  availability: products.availability,
} as const

/** Linha sem as colunas de margem — o que a projeção de cliente devolve. */
export type CustomerFacingProductRow = {
  [Key in keyof typeof CUSTOMER_FACING_PRODUCT_COLUMNS]: ProductRow[Key]
}

export class ProductRepository {
  constructor(private readonly db: CatalogDatabase) {}

  async create(values: NewProductRow): Promise<ProductRow> {
    const [row] = await this.db.insert(products).values(values).returning()
    if (!row) throw new Error('catalog-module: insert em products não retornou linha')
    return row
  }

  async findById(params: { companyId: string; id: string }): Promise<ProductRow | undefined> {
    const [row] = await this.db.select().from(products).where(productOwnedByCondition(params)).limit(1)
    return row
  }

  async findByBarcode(params: { companyId: string; barcode: string }): Promise<ProductRow | undefined> {
    const [row] = await this.db
      .select()
      .from(products)
      .where(and(productListCondition(params), eq(products.barcode, params.barcode)))
      .limit(1)
    return row
  }

  async list(query: ListProductsQuery): Promise<ListProductsPage> {
    const conditions = [
      query.search ? productSearchCondition({ ...query, search: query.search }) : productListCondition(query),
    ]
    if (query.catalogId) conditions.push(eq(products.catalogId, query.catalogId))
    if (query.sectionId) conditions.push(eq(products.sectionId, query.sectionId))
    if (query.active !== undefined) conditions.push(eq(products.active, query.active))
    if (query.syncStatus) conditions.push(eq(products.syncStatus, query.syncStatus))

    const where = and(...conditions)

    // Paginação por offset (não cursor): a UI de catálogo tem numeração de página e o operador
    // pula direto para a 7ª — cursor não atende isso. O `pageSize` é limitado no schema zod.
    const [rows, [counted]] = await Promise.all([
      this.db
        .select()
        .from(products)
        .where(where)
        .orderBy(asc(products.sortOrder), asc(products.name))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(products)
        .where(where),
    ])

    return { rows, total: counted?.value ?? 0 }
  }

  async update(params: {
    companyId: string
    id: string
    values: Partial<NewProductRow>
  }): Promise<ProductRow | undefined> {
    const [row] = await this.db
      .update(products)
      .set({ ...params.values, updatedAt: new Date() })
      .where(productOwnedByCondition(params))
      .returning()
    return row
  }

  async softDelete(params: { companyId: string; id: string }): Promise<boolean> {
    const [row] = await this.db
      .update(products)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(productOwnedByCondition(params))
      .returning({ id: products.id })
    return row !== undefined
  }

  async countByCatalog(params: { companyId: string; catalogId: string }): Promise<number> {
    const [counted] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(products)
      .where(and(productListCondition(params), eq(products.catalogId, params.catalogId)))
    return counted?.value ?? 0
  }

  /**
   * Baixa de estoque **atômica**: a condição `inventory >= quantity` vive no próprio `UPDATE`, e
   * o resultado é decidido pelo número de linhas afetadas.
   *
   * Ler o saldo e depois gravar (`read-then-write`) permitiria que dois pedidos simultâneos do
   * último item lessem o mesmo `1` e ambos passassem — o banco é o único lugar onde essa corrida
   * pode ser resolvida sem lock explícito.
   *
   * Devolve o estoque resultante, para o chamador saber se **este** consumo foi o que zerou (e
   * disparar `onProductOutOfStock` uma vez, não a cada venda).
   */
  async consumeInventory(params: { companyId: string; id: string; quantity: number }): Promise<{ remaining: number }> {
    const [row] = await this.db
      .update(products)
      .set({ inventory: sql`${products.inventory} - ${params.quantity}`, updatedAt: new Date() })
      .where(
        and(
          productOwnedByCondition({ companyId: params.companyId, id: params.id }),
          sql`${products.inventory} >= ${params.quantity}`,
        ),
      )
      .returning({ inventory: products.inventory })

    if (!row) {
      const current = await this.findById({ companyId: params.companyId, id: params.id })
      // Estoque não controlado (`null`) não bloqueia venda — quem não controla, não fica sem.
      if (current && current.inventory === null) return { remaining: Number.POSITIVE_INFINITY }
      throw new InsufficientInventoryError(params.id, current?.inventory ?? 0, params.quantity)
    }

    return { remaining: row.inventory ?? 0 }
  }

  /**
   * Leitura para o canal do cliente: seleciona **só** as colunas de
   * `CUSTOMER_FACING_PRODUCT_COLUMNS`, então `cost_price_in_cents` nem sai do banco.
   *
   * A barreira no mapeamento (`toProduct(row, 'customer')`) continua existindo, mas ela sozinha
   * depende de o chamador lembrar do argumento. Esta aqui não depende de ninguém lembrar.
   */
  async findByIdForCustomer(params: { companyId: string; id: string }): Promise<CustomerFacingProductRow | undefined> {
    const [row] = await this.db
      .select(CUSTOMER_FACING_PRODUCT_COLUMNS)
      .from(products)
      .where(productOwnedByCondition(params))
      .limit(1)
    return row
  }

  async listForCustomer(query: {
    companyId: string
    search?: string
    limit: number
  }): Promise<CustomerFacingProductRow[]> {
    const where = and(
      query.search
        ? productSearchCondition({ companyId: query.companyId, search: query.search })
        : productListCondition(query),
      eq(products.active, true),
    )

    return this.db
      .select(CUSTOMER_FACING_PRODUCT_COLUMNS)
      .from(products)
      .where(where)
      .orderBy(asc(products.sortOrder), asc(products.name))
      .limit(query.limit)
  }

  /** Usado pelo `RetryFailedSyncs`; não é rota exposta. */
  async listBySyncStatus(params: { companyId: string; syncStatus: string; limit: number }): Promise<ProductRow[]> {
    return this.db
      .select()
      .from(products)
      .where(and(productListCondition(params), eq(products.syncStatus, params.syncStatus)))
      .limit(params.limit)
  }

  /**
   * Produtos com imagem guardada no bucket, para a indexacao visual. Pagina por `id` em vez de
   * `offset` porque a varredura roda em lote sobre a base inteira: com offset, uma linha inserida
   * no meio desloca a janela e pula produtos silenciosamente.
   */
  async listIndexableImages(params: {
    companyId: string
    limit: number
    afterId?: string
  }): Promise<{ id: string; imageStorageKey: string }[]> {
    const rows = await this.db
      .select({ id: products.id, imageStorageKey: products.imageStorageKey })
      .from(products)
      .where(
        and(
          productListCondition(params),
          eq(products.active, true),
          isNotNull(products.imageStorageKey),
          params.afterId ? gt(products.id, params.afterId) : undefined,
        ),
      )
      .orderBy(products.id)
      .limit(params.limit)

    return rows.flatMap((row) => (row.imageStorageKey ? [{ id: row.id, imageStorageKey: row.imageStorageKey }] : []))
  }

  async markSync(params: {
    companyId: string
    id: string
    syncStatus: string
    externalId?: string
    syncError?: string | null
  }): Promise<void> {
    await this.db
      .update(products)
      .set({
        syncStatus: params.syncStatus,
        externalId: params.externalId,
        syncError: params.syncError ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(products.companyId, params.companyId), eq(products.id, params.id), isNull(products.deletedAt)))
  }
}
