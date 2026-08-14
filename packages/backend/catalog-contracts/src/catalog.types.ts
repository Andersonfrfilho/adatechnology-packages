/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Fonte única dos tipos de catálogo. Estes tipos **já existiam**, escritos em
 * `products-ui/src/providers/types.ts` — bem desenhados, mas presos no frontend, onde o backend
 * não conseguia tipar contra eles. Extrair para cá é o que fecha o trio: agora as duas pontas
 * quebram em compile-time quando o contrato muda, em vez de divergirem em produção.
 */

export type CatalogId = string
export type ProductId = string
export type SectionId = string
export type CompanyId = string

/**
 * Estado da sincronização com o catálogo da Meta. `null` (ou ausente) diz que o host **não
 * sincroniza** — diferente de `pending`, que é "vai subir e ainda não subiu". A distinção existe
 * para a UI não mostrar estado de publicação a quem não publica.
 */
export const PRODUCT_SYNC_STATUS = {
  PENDING: 'pending',
  SYNCED: 'synced',
  FAILED: 'failed',
} as const
export type ProductSyncStatus = (typeof PRODUCT_SYNC_STATUS)[keyof typeof PRODUCT_SYNC_STATUS]

/** Vocabulário da Meta Commerce; o módulo o deriva do estoque quando o host controla inventário. */
export const PRODUCT_AVAILABILITY = {
  IN_STOCK: 'in stock',
  OUT_OF_STOCK: 'out of stock',
} as const
export type ProductAvailability = (typeof PRODUCT_AVAILABILITY)[keyof typeof PRODUCT_AVAILABILITY]

export type Product = {
  readonly id: ProductId
  readonly name: string
  readonly description: string | null
  /**
   * Centavos inteiros, nunca decimal nem string formatada — arredondamento de valor de venda não
   * pode acontecer por acidente de ponto flutuante. A moeda é do consumidor, não do produto.
   */
  readonly priceInCents: number
  readonly imageUrl: string | null
  readonly catalogId: CatalogId | null
  readonly catalogName?: string
  readonly active: boolean
  readonly sortOrder: number
  readonly availability: ProductAvailability

  /** `null` = estoque não controlado; a disponibilidade vira decisão manual. */
  readonly inventory?: number | null
  readonly costPriceInCents?: number | null
  readonly unit?: string | null
  readonly barcode?: string | null
  readonly sectionId?: SectionId | null
  readonly sectionName?: string
  readonly preparationTimeMinutes?: number | null
  /** Ficha técnica para quem produz — separado de `description`, que é o que o cliente lê. */
  readonly preparationInstructions?: string | null

  /**
   * Fabricante ("Nescafé", "Piracanjuba"). Separado do nome porque em mercearia é ele que decide
   * entre dois itens homônimos, e concatenar no nome torna a busca por marca impossível.
   */
  readonly brand?: string | null
  /**
   * Tamanho da embalagem como está escrito no rótulo ("500g", "1L", "fardo 12un").
   *
   * Texto, e não número + `unit`: "fardo 12un" e "cx 24x350ml" não têm forma numérica única, e
   * quem confere a sacola lê o rótulo, não uma conversão nossa.
   */
  readonly unitSize?: string | null
  /**
   * Onde o item fica na loja física, na placa pendurada no corredor ("Corredor 3", "Hortifruti").
   *
   * Não é `sectionId`: aquilo agrupa o catálogo (e, em restaurante, é o posto de produção). Este é
   * endereço de prateleira, existe só em quem tem loja física, e é `null` na maioria dos itens —
   * nenhuma loja mapeia o catálogo inteiro de uma vez.
   */
  readonly aisle?: string | null
  /**
   * Como o cliente chama o produto ("miojo", "leite moça", "coca 2l").
   *
   * Alimenta a busca por texto; quem vende por conversa depende disto para casar fala com SKU, e
   * sem os apelidos o casamento fica preso ao nome do rótulo, que ninguém fala.
   */
  readonly aliases?: readonly string[]

  readonly externalId?: string | null
  readonly syncStatus?: ProductSyncStatus | null
  readonly syncError?: string | null
}

export type Catalog = {
  readonly id: CatalogId
  readonly name: string
  readonly description: string | null
  readonly active: boolean
  readonly productCount?: number
  readonly sortOrder?: number

  /** Na Meta, um catálogo do host vira um *product set* dentro do catálogo da conta. */
  readonly externalId?: string | null
  readonly syncStatus?: ProductSyncStatus | null
  readonly syncError?: string | null
}

/**
 * `catalogId` ausente = seção válida para todo o catálogo. Em restaurante a seção é o posto de
 * produção (cozinha, bar, chapa) e o mesmo posto atende itens de categorias diferentes — amarrar
 * seção a catálogo obrigaria a duplicar cada seção por categoria só para exibi-la.
 */
export type Section = {
  readonly id: SectionId
  readonly name: string
  readonly catalogId?: CatalogId | null
  readonly sortOrder?: number
}

export type PaginatedResponse<TItem> = {
  readonly data: readonly TItem[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly totalPages: number
}

export type CreateProductInput = {
  readonly name: string
  readonly description?: string
  readonly priceInCents: number
  readonly costPriceInCents?: number
  readonly unit?: string
  readonly barcode?: string
  readonly catalogId?: CatalogId
  readonly sectionId?: SectionId
  readonly imageUrl?: string
  readonly inventory?: number
  readonly preparationTimeMinutes?: number
  readonly preparationInstructions?: string
  readonly sortOrder?: number
  readonly brand?: string | null
  readonly unitSize?: string | null
  readonly aisle?: string | null
  /** Substitui a lista inteira — quem acrescenta um apelido precisa mandar os atuais junto. */
  readonly aliases?: readonly string[]
}

export type UpdateProductInput = Partial<CreateProductInput> & {
  readonly active?: boolean
}

export type CreateCatalogInput = {
  readonly name: string
  readonly description?: string
  readonly sortOrder?: number
}

export type UpdateCatalogInput = Partial<CreateCatalogInput> & {
  readonly active?: boolean
}

export type CreateSectionInput = {
  readonly name: string
  readonly catalogId?: CatalogId
  readonly sortOrder?: number
}

export type UpdateSectionInput = Partial<CreateSectionInput>

export type ListProductsParams = {
  readonly companyId: CompanyId
  readonly page?: number
  readonly pageSize?: number
  readonly search?: string
  readonly catalogId?: CatalogId
  readonly sectionId?: SectionId
  readonly active?: boolean
  /** Filtro de operação: "o que ainda não subiu para a Meta". */
  readonly syncStatus?: ProductSyncStatus
}

export type ListCatalogsParams = {
  readonly companyId: CompanyId
  readonly page?: number
  readonly pageSize?: number
  readonly search?: string
  readonly active?: boolean
}

export type BulkImportRowError = {
  readonly row: number
  readonly message: string
}

export type BulkImportResult = {
  readonly succeeded: number
  readonly failed: number
  readonly errors: readonly BulkImportRowError[]
}

/**
 * Sincronização com o catálogo da Meta (WhatsApp e Instagram Shopping). **Desligada por padrão:**
 * vertical que não vende por WhatsApp não deve ver estado de sincronização nem botão de publicar.
 * Produto e catálogo são flags independentes porque a Meta os trata como entidades distintas — dá
 * para publicar itens num catálogo único sem espelhar a divisão interna em product sets.
 */
export type MetaSyncConfig = {
  readonly products: boolean
  readonly catalogs: boolean
}

export const DEFAULT_META_SYNC: MetaSyncConfig = { products: false, catalogs: false }
