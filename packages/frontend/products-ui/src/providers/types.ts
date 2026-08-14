import type { BackgroundRemovalConfig } from '../removeBackground'

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
  // Varejo físico: marca e embalagem separam dois itens homônimos na prateleira, corredor é onde
  // ele fica na loja, e apelido é como o cliente o chama. Fora dos padrões porque catálogo de
  // serviço ou de restaurante não tem nenhum dos quatro.
  BRAND: 'brand',
  UNIT_SIZE: 'unitSize',
  AISLE: 'aisle',
  ALIASES: 'aliases',
} as const
export type ProductOptionalField = (typeof PRODUCT_OPTIONAL_FIELD)[keyof typeof PRODUCT_OPTIONAL_FIELD]

// As duas superfícies que desenham campo opcional. Ficha técnica da cozinha faz sentido no
// formulário e não na tabela; marca faz sentido nos dois — e uma lista só não sabe separar isso.
export const PRODUCT_SURFACE = {
  FORM: 'form',
  LIST: 'list',
} as const
export type ProductSurface = (typeof PRODUCT_SURFACE)[keyof typeof PRODUCT_SURFACE]

// O que se configura de um campo. Tudo opcional: declarar o campo já é dizer que ele aparece, e
// `{}` é a configuração mais comum — "mostra, do jeito padrão".
export type ProductFieldOptions = {
  // `false` esconde nas duas superfícies; o objeto esconde só numa. Ausente = aparece.
  readonly visible?: boolean | { readonly form?: boolean; readonly list?: boolean }
  readonly required?: boolean
  // String vale para as duas superfícies; o objeto separa rótulo de campo de cabeçalho de coluna.
  readonly label?: string | { readonly form?: string; readonly list?: string }
}

// A tabela de campos: uma entrada por campo, com as opções dele juntas. É a forma que responde
// "o que este host faz com marca?" num lugar só, em vez de procurar o nome do campo em três listas.
export type ProductFieldsMap = { readonly [TField in ProductField]?: ProductFieldOptions }

/**
 * Quais campos a tela desenha, em uma de três formas.
 *
 * - `['brand', 'barcode']` — os mesmos campos opcionais nas duas superfícies. É o que todo host usa
 *   hoje, e trocar por objeto obrigatório quebraria todos eles para resolver o problema de um.
 * - `{ form: [...], list: [...] }` — superfícies com campos diferentes. Superfície ausente não
 *   desenha campo opcional nenhum.
 * - `{ brand: { required: true, label: 'Fabricante' }, aisle: { visible: { list: false } } }` — a
 *   tabela por campo, quando visibilidade sozinha não basta.
 *
 * As três se distinguem sem discriminante: array é array, e nenhum campo se chama `form` ou `list`.
 */
export type ProductFieldsConfig =
  | readonly ProductOptionalField[]
  | {
      readonly form?: readonly ProductOptionalField[]
      readonly list?: readonly ProductOptionalField[]
    }
  | ProductFieldsMap

function asFieldsMap(fields: ProductFieldsConfig): ProductFieldsMap | null {
  if (Array.isArray(fields)) return null
  const candidate = fields as Record<string, unknown>
  if ('form' in candidate || 'list' in candidate) return null
  return fields as ProductFieldsMap
}

function isVisibleInMap(options: ProductFieldOptions, surface: ProductSurface): boolean {
  const { visible } = options
  if (visible === undefined) return true
  if (typeof visible === 'boolean') return visible
  return visible[surface] ?? true
}

/**
 * Se o campo é desenhado na superfície.
 *
 * Núcleo e extensão têm padrões opostos, e isso é deliberado: campo de vertical (marca, corredor)
 * não aparece até ser declarado — senão um catálogo de serviços mostraria colunas vazias; campo do
 * núcleo (descrição, catálogo, imagem) aparece até ser escondido, porque ele já estava na tela
 * antes de existir configuração. Nome e preço não se escondem: sem eles não há produto.
 */
export function isProductFieldVisible(params: {
  readonly fields: ProductFieldsConfig
  readonly field: ProductField
  readonly surface: ProductSurface
}): boolean {
  const { fields, field, surface } = params
  if (ALWAYS_REQUIRED_PRODUCT_FIELDS.includes(field)) return true

  const isVerticalField = (Object.values(PRODUCT_OPTIONAL_FIELD) as readonly string[]).includes(field)
  const map = asFieldsMap(fields)
  if (map) {
    const options = map[field]
    if (!options) return !isVerticalField
    return isVisibleInMap(options, surface)
  }

  if (!isVerticalField) return true
  const declared = Array.isArray(fields)
    ? (fields as readonly ProductOptionalField[])
    : ((fields as { readonly [TSurface in ProductSurface]?: readonly ProductOptionalField[] })[surface] ?? [])
  return declared.includes(field as ProductOptionalField)
}

export function resolveProductFields(
  fields: ProductFieldsConfig,
  surface: ProductSurface,
): readonly ProductOptionalField[] {
  const map = asFieldsMap(fields)
  if (map) {
    return Object.values(PRODUCT_OPTIONAL_FIELD).filter((field) => isProductFieldVisible({ fields, field, surface }))
  }
  if (Array.isArray(fields)) return fields
  return (fields as { readonly [TSurface in ProductSurface]?: readonly ProductOptionalField[] })[surface] ?? []
}

// Todo campo que ganha rótulo na tela — o núcleo e as extensões juntos. É um conjunto maior que
// `PRODUCT_OPTIONAL_FIELD` de propósito: "Nome do produto" e "Preço de venda" sempre aparecem, e
// ainda assim são os que mais mudam de nome entre verticais ("Serviço", "Valor da sessão").
export const PRODUCT_FIELD = {
  NAME: 'name',
  DESCRIPTION: 'description',
  PRICE: 'price',
  COST_PRICE: 'costPrice',
  UNIT: 'unit',
  UNIT_SIZE: 'unitSize',
  BRAND: 'brand',
  AISLE: 'aisle',
  ALIASES: 'aliases',
  BARCODE: 'barcode',
  CATALOG: 'catalog',
  SECTION: 'section',
  IMAGE: 'image',
  INVENTORY: 'inventory',
  PREPARATION_TIME: 'preparationTime',
  PREPARATION_INSTRUCTIONS: 'preparationInstructions',
  SORT_ORDER: 'sortOrder',
  ACTIVE: 'active',
} as const
export type ProductField = (typeof PRODUCT_FIELD)[keyof typeof PRODUCT_FIELD]

export type ProductFieldLabels = Partial<Record<ProductField, string>>

// O rótulo do formulário é a forma por extenso; o da tabela é a abreviação que cabe na coluna.
// Duas tabelas, e não uma, porque "Embalagem" no cabeçalho empurra preço e estoque para fora da
// tela, e "Emb." num rótulo de campo não diz nada a quem está cadastrando.
export const DEFAULT_PRODUCT_FIELD_LABELS: Record<ProductField, string> = {
  name: 'Nome do produto',
  description: 'Descrição',
  price: 'Preço de venda',
  costPrice: 'Preço de custo',
  unit: 'Unidade',
  unitSize: 'Embalagem',
  brand: 'Marca',
  aisle: 'Corredor',
  aliases: 'Apelidos',
  barcode: 'Código de barras',
  catalog: 'Catálogo',
  section: 'Seção',
  image: 'Imagem',
  inventory: 'Estoque',
  preparationTime: 'Tempo de preparo (min)',
  preparationInstructions: 'Modo de preparo',
  sortOrder: 'Ordem de exibição',
  active: 'Produto ativo',
}

export const DEFAULT_PRODUCT_COLUMN_LABELS: Record<ProductField, string> = {
  ...DEFAULT_PRODUCT_FIELD_LABELS,
  name: 'Nome',
  price: 'Preço',
  unit: 'Un',
  unitSize: 'Emb.',
  barcode: 'Cód.barras',
  image: 'Img',
  preparationTime: 'Preparo',
  active: 'Ativo',
}

/**
 * Rótulos por superfície. A tabela simples vale para as duas — quem renomeia "Corredor" para
 * "Setor" quer o novo nome no formulário e no cabeçalho, e obrigar a repetir seria só cerimônia.
 * Campo não declarado mantém o rótulo padrão daquela superfície.
 */
export type ProductLabelsConfig =
  | ProductFieldLabels
  | {
      readonly form?: ProductFieldLabels
      readonly list?: ProductFieldLabels
    }

// Núcleo do produto: sem nome e sem preço não existe item vendável, e desligar isso pela
// configuração da tela só adiaria a rejeição para o 400 da API.
export const ALWAYS_REQUIRED_PRODUCT_FIELDS: readonly ProductField[] = [PRODUCT_FIELD.NAME, PRODUCT_FIELD.PRICE]

/**
 * Se o formulário exige o campo. Núcleo é sempre exigido; campo de vertical desligado nunca é —
 * exigir o que não se desenha travaria o salvamento sem mostrar onde está o problema.
 */
export function isProductFieldRequired(params: {
  readonly requiredFields: readonly ProductField[] | undefined
  readonly fields: ProductFieldsConfig
  readonly field: ProductField
}): boolean {
  const { requiredFields, fields, field } = params
  if (ALWAYS_REQUIRED_PRODUCT_FIELDS.includes(field)) return true

  const declaredInMap = asFieldsMap(fields)?.[field]?.required === true
  if (!declaredInMap && !requiredFields?.includes(field)) return false

  return isProductFieldVisible({ fields, field, surface: PRODUCT_SURFACE.FORM })
}

export function resolveProductLabel(params: {
  readonly labels: ProductLabelsConfig | undefined
  readonly field: ProductField
  readonly surface: ProductSurface
  // A tabela por campo também carrega rótulo, e ela ganha de `labels`: quem configurou o campo
  // inteiro num lugar só não espera que uma tabela separada sobrescreva por baixo.
  readonly fields?: ProductFieldsConfig
}): string {
  const { labels, field, surface, fields } = params
  const defaults = surface === PRODUCT_SURFACE.LIST ? DEFAULT_PRODUCT_COLUMN_LABELS : DEFAULT_PRODUCT_FIELD_LABELS

  const fromMap = fields ? asFieldsMap(fields)?.[field]?.label : undefined
  if (typeof fromMap === 'string') return fromMap
  if (fromMap?.[surface]) return fromMap[surface]

  if (!labels) return defaults[field]

  const perSurface = labels as { readonly form?: ProductFieldLabels; readonly list?: ProductFieldLabels }
  // Nenhum campo se chama `form` ou `list`, então a presença de uma das chaves distingue as duas
  // formas sem precisar de discriminante explícito.
  const isPerSurface = 'form' in perSurface || 'list' in perSurface
  const overrides = isPerSurface ? (perSurface[surface] ?? {}) : (labels as ProductFieldLabels)
  return overrides[field] ?? defaults[field]
}

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

  // Fabricante. Separado do nome porque em mercearia é ele que decide entre dois itens homônimos,
  // e concatenar no nome torna a busca por marca impossível.
  readonly brand?: string | null
  // Tamanho da embalagem como está no rótulo ("500g", "fardo 12un") — texto, porque "cx 24x350ml"
  // não tem forma numérica única e quem confere a sacola lê o rótulo.
  readonly unitSize?: string | null
  // Onde o item fica na loja física, na placa do corredor. Não é `sectionId`, que agrupa catálogo.
  readonly aisle?: string | null
  // Como o cliente chama o produto ("miojo", "leite moça"). Alimenta a busca por texto.
  readonly aliases?: readonly string[]

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
  readonly brand?: string | null
  readonly unitSize?: string | null
  readonly aisle?: string | null
  // Substitui a lista inteira — quem acrescenta um apelido manda os atuais junto.
  readonly aliases?: readonly string[]
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
  readonly fields: ProductFieldsConfig
  // Renomeia campo e coluna. Ausente, valem os rótulos padrão.
  readonly labels?: ProductLabelsConfig
  /**
   * Campos que o formulário exige **além** de nome e preço, que são sempre obrigatórios.
   *
   * Mercearia quer marca preenchida, restaurante não tem marca — e a diferença é do host, não do
   * schema. Campo desligado em `fields` é ignorado aqui: não dá para exigir o que não se desenha.
   *
   * Isto é ergonomia de formulário, não regra de negócio: a API continua sendo quem valida, e
   * quem importa em massa não passa por esta tela.
   */
  readonly requiredFields?: readonly ProductField[]
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
