export type MetaCatalogProviderConfig = {
  readonly accessToken: string
  readonly apiVersion?: string
  readonly catalogId?: string
  readonly wabaId?: string
  readonly businessId?: string
  readonly phoneNumberId?: string
  // Sobrescreve https://graph.facebook.com — usado para apontar para um mock local (ex.: WireMock)
  // em dev/teste. Em produção, deixe undefined para usar a Graph API real.
  readonly baseUrl?: string
}

export type ProductAvailability = 'in stock' | 'out of stock' | 'preorder' | 'available for order' | 'discontinued'
export type ProductCondition = 'new' | 'refurbished' | 'used'

export type CatalogProductInput = {
  readonly retailerId: string
  readonly name: string
  readonly description: string
  readonly priceInCents: number
  readonly currency: string
  readonly imageUrl: string
  readonly categoryLabel: string
  readonly availability?: ProductAvailability
  readonly condition?: ProductCondition
  // Quantidade em estoque publicada no item do catálogo. Omitir mantém o comportamento anterior:
  // a Meta trata a disponibilidade só por `availability`, definida manualmente pelo consumidor.
  readonly inventory?: number
  readonly url?: string
  readonly catalogId?: string
}

export type UpdateCatalogProductParams = {
  readonly productId: string
  readonly input: Partial<CatalogProductInput>
}

export type CatalogProductResult = {
  readonly id: string
}

export type CatalogProductSetInput = {
  readonly name: string
  readonly categoryLabel: string
  readonly catalogId?: string
}

export type UpdateCatalogProductSetParams = {
  readonly productSetId: string
  readonly name: string
}

export type CatalogProductSetResult = {
  readonly id: string
}

export type CatalogProductDetail = CatalogProductInput & {
  readonly id: string
}

export type CatalogSummary = {
  readonly id: string
  readonly name: string
}

export type CatalogProductSummary = {
  readonly id: string
  readonly retailerId: string
  readonly name: string
}

export type ListCatalogProductsParams = {
  readonly catalogId?: string
}

export type CreateCatalogParams = {
  readonly name: string
  readonly vertical?: string
}

export type CreateCatalogResult = {
  readonly id: string
}

export type UpdateCatalogParams = {
  readonly catalogId: string
  readonly name: string
}

export type LinkCatalogToWabaParams = {
  readonly catalogId: string
}

export type CommerceSettings = {
  readonly isCatalogVisible: boolean
  readonly isCartEnabled: boolean
}

export type UpdateCommerceSettingsParams = Partial<CommerceSettings>
