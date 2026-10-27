import type { BackgroundRemovalConfig } from '@adatechnology/image-cutout'

export type ProductsApi = {
  listProducts(params?: {
    page?: number
    search?: string
    catalogId?: string
    active?: boolean
  }): Promise<PaginatedResponse<Product>>
  getProduct(id: string): Promise<Product>
  createProduct(data: CreateProductInput): Promise<Product>
  updateProduct(id: string, data: UpdateProductInput): Promise<Product>
  deleteProduct(id: string): Promise<void>

  listCatalogs(params?: { page?: number; search?: string }): Promise<PaginatedResponse<Catalog>>
  getCatalog(id: string): Promise<Catalog>
  createCatalog(data: CreateCatalogInput): Promise<Catalog>
  updateCatalog(id: string, data: UpdateCatalogInput): Promise<Catalog>
  deleteCatalog(id: string): Promise<void>

  /**
   * Capacidade por ausência: sem ela, o formulário não desenha o upload e só aceita URL. Instalação
   * sem bucket não deve mostrar um alvo de arrastar arquivo que sempre falha.
   */
  uploadImage?(file: File): Promise<{ readonly url: string; readonly key: string }>
  bulkImportProducts(file: File): Promise<BulkImportResult>
}

// Campos que só existem em algumas verticais. Nenhum deles é obrigatório no produto, e a UI só
// os desenha quando o consumidor os declara em `ProductsConfig.fields` — um catálogo de serviços
// não tem código de barras nem tempo de preparo, e não deve exibir campos vazios por isso.
export const PRODUCT_OPTIONAL_FIELD = {
  COST_PRICE: 'costPrice',
  UNIT: 'unit',
  BARCODE: 'barcode',
  SECTION: 'section',
  PREPARATION_TIME: 'preparationTime',
  PREPARATION_INSTRUCTIONS: 'preparationInstructions',
  INVENTORY: 'inventory',
  SORT_ORDER: 'sortOrder',
} as const
export type ProductOptionalField = (typeof PRODUCT_OPTIONAL_FIELD)[keyof typeof PRODUCT_OPTIONAL_FIELD]

// Estado da sincronização do item com o catálogo da Meta. Faz parte do núcleo, e não das
// extensões, porque é inerente a catálogo Meta: qualquer consumidor que publique produtos lá
// precisa mostrar o que ainda não subiu e o porquê. `syncStatus: null` diz que o host não
// sincroniza — diferente de `pending`, que é "vai subir e ainda não subiu".
export const PRODUCT_SYNC_STATUS = {
  PENDING: 'pending',
  SYNCED: 'synced',
  FAILED: 'failed',
} as const
export type ProductSyncStatus = (typeof PRODUCT_SYNC_STATUS)[keyof typeof PRODUCT_SYNC_STATUS]

export type Product = {
  readonly id: string
  readonly name: string
  readonly description: string | null
  // Dinheiro trafega em centavos inteiros, nunca em decimal ou string formatada: o componente não
  // pode arredondar valor de venda, e a moeda vem da configuração do consumidor (ProductsConfig).
  readonly priceInCents: number
  readonly imageUrl: string | null
  readonly catalogId: string | null
  readonly catalogName?: string
  readonly active: boolean
  readonly sortOrder: number
  readonly availability: string

  // `null` = estoque não controlado, disponibilidade definida manualmente.
  readonly inventory?: number | null
  readonly costPriceInCents?: number | null
  readonly unit?: string | null
  readonly barcode?: string | null
  readonly sectionId?: string | null
  readonly sectionName?: string
  readonly preparationTimeMinutes?: number | null
  // Texto livre para quem produz o item (ficha técnica, ponto da carne, ordem de montagem). É
  // separado de `description`, que é o que o cliente lê.
  readonly preparationInstructions?: string | null

  readonly externalId?: string | null
  readonly syncStatus?: ProductSyncStatus | null
  readonly syncError?: string | null
}

export type Catalog = {
  readonly id: string
  readonly name: string
  readonly description: string | null
  readonly active: boolean
  readonly productCount?: number
  // Ordem de exibição ao cliente final. Opcional porque nem todo host a persiste: quem não manda o
  // campo continua com a ordem que a API devolver.
  readonly sortOrder?: number

  // Espelho do que o `Product` já carrega. Só faz sentido quando `metaSync.catalogs` está ligado:
  // na Meta, um catálogo do host vira um product set dentro do catálogo da conta.
  readonly externalId?: string | null
  readonly syncStatus?: ProductSyncStatus | null
  readonly syncError?: string | null
}

// `catalogId` ausente = seção válida para todo o catálogo. Nem todo negócio subdivide seção por
// catálogo: em restaurante ela é o posto de produção (cozinha, bar, chapa), e o mesmo posto atende
// itens de categorias diferentes. Amarrar seção a catálogo obrigaria o consumidor a duplicar cada
// seção por categoria só para conseguir exibi-la.
export type Section = {
  readonly id: string
  readonly name: string
  readonly catalogId?: string | null
}

// Sugestão vinda de base externa de produtos (GTIN, OpenFoodFacts, distribuidor). O componente só
// preenche o formulário com ela — nada é persistido antes de o usuário salvar.
export type ProductSuggestion = {
  readonly name: string
  readonly brand?: string
  readonly barcode?: string
  readonly imageUrl?: string
  readonly category?: string
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
  readonly catalogId?: string
  readonly sectionId?: string
  readonly imageUrl?: string
  readonly inventory?: number
  readonly preparationTimeMinutes?: number
  readonly preparationInstructions?: string
}

export type UpdateProductInput = Partial<CreateProductInput> & {
  readonly active?: boolean
  readonly sortOrder?: number
}

export type CreateCatalogInput = {
  readonly name: string
  readonly description?: string
  readonly sortOrder?: number
}

export type UpdateCatalogInput = Partial<CreateCatalogInput> & {
  readonly active?: boolean
}

// Sincronização com o catálogo da Meta (WhatsApp e Instagram Shopping). Desligada por padrão:
// vertical que não vende por WhatsApp não deve ver estado de sincronização nem botão de publicar.
// Produto e catálogo são independentes porque a Meta os trata como entidades distintas — dá para
// publicar itens em um catálogo único sem espelhar a divisão interna em product sets.
export type MetaSyncConfig = {
  readonly products: boolean
  readonly catalogs: boolean
}

export const DEFAULT_META_SYNC: MetaSyncConfig = { products: false, catalogs: false }

export type BulkImportResult = {
  readonly succeeded: number
  readonly failed: number
  readonly errors: ReadonlyArray<{ readonly row: number; readonly message: string }>
}

export type ProductsConfig = {
  // Código ISO 4217 e locale usados para formatar e para ler o que o usuário digita. Sem isto o
  // pacote assumiria BRL/pt-BR, o que só serve a um consumidor.
  readonly currency: string
  readonly locale: string
  readonly fields: readonly ProductOptionalField[]
  readonly unitOptions?: readonly string[]
  // Atalhos de margem **sobre o preço de venda** — a mesma conta de `applyMarginToCost`. Vazio
  // esconde os botões. Valor >= 100 é descartado por aquele helper: margem de 100% sobre a venda
  // implicaria custo zero.
  readonly marginShortcutPercents?: readonly number[]
  readonly metaSync?: MetaSyncConfig
  // Ausente, o botão de remover fundo não é desenhado — capacidade por ausência. O host informa de
  // onde o modelo é servido porque ele pesa alguns MB e não cabe dentro do pacote.
  readonly backgroundRemoval?: BackgroundRemovalConfig
}

export const DEFAULT_UNIT_OPTIONS = ['un', 'kg', 'g', 'l', 'ml', 'pc', 'cx', 'dz'] as const

export const DEFAULT_PRODUCTS_CONFIG: ProductsConfig = {
  currency: 'BRL',
  locale: 'pt-BR',
  fields: [
    PRODUCT_OPTIONAL_FIELD.COST_PRICE,
    PRODUCT_OPTIONAL_FIELD.UNIT,
    PRODUCT_OPTIONAL_FIELD.BARCODE,
    PRODUCT_OPTIONAL_FIELD.SECTION,
    PRODUCT_OPTIONAL_FIELD.PREPARATION_TIME,
    PRODUCT_OPTIONAL_FIELD.INVENTORY,
  ],
  unitOptions: DEFAULT_UNIT_OPTIONS,
  marginShortcutPercents: [30, 50, 60],
  metaSync: DEFAULT_META_SYNC,
}
