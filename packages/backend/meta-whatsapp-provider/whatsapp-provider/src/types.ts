export type WhatsAppProviderConfig = {
  readonly accessToken: string
  readonly apiVersion?: string
  readonly phoneNumberId?: string
  readonly catalogId?: string
  readonly wabaId?: string
  readonly businessId?: string
  // Sobrescreve https://graph.facebook.com — usado para apontar para um mock local (ex.: WireMock)
  // em dev/teste. Em produção, deixe undefined para usar a Graph API real.
  readonly baseUrl?: string
}

// ---- Messages ----

export type SendMessageResult = {
  readonly waMessageId: string | null
}

export type SendMediaParams = {
  readonly to: string
  readonly buffer: Buffer
  readonly mimeType: string
  readonly filename: string
  readonly caption?: string
}

export type SendTemplateParams = {
  readonly to: string
  readonly templateName: string
  readonly languageCode?: string
  readonly bodyParameters?: readonly string[]
}

export type FetchMediaResult = {
  readonly data: string
  readonly mimeType: string
}

export type InteractiveButton = {
  readonly id: string
  readonly title: string
}

export type SendInteractiveButtonsParams = {
  readonly to: string
  readonly bodyText: string
  readonly buttons: readonly InteractiveButton[]
}

export type InteractiveListRow = {
  readonly id: string
  readonly title: string
  readonly description?: string
}

export type InteractiveListSection = {
  readonly title: string
  readonly rows: readonly InteractiveListRow[]
}

export type SendInteractiveListParams = {
  readonly to: string
  readonly bodyText: string
  readonly buttonText: string
  readonly sections: readonly InteractiveListSection[]
}

export type SendCatalogMessageParams = {
  readonly to: string
  readonly bodyText: string
  readonly catalogId?: string
  readonly footerText?: string
}

export type SendProductMessageParams = {
  readonly to: string
  readonly retailerId: string
  readonly catalogId?: string
  readonly bodyText?: string
  readonly footerText?: string
}

export type ProductListSection = {
  readonly title: string
  readonly retailerIds: readonly string[]
}

export type SendProductListMessageParams = {
  readonly to: string
  readonly headerText: string
  readonly bodyText: string
  readonly catalogId?: string
  readonly footerText?: string
  readonly sections: readonly ProductListSection[]
}

// ---- Templates ----

export type CreateTemplateParams = {
  readonly name: string
  readonly category: 'MARKETING' | 'UTILITY'
  readonly language?: string
  readonly headerType?: 'NONE' | 'TEXT'
  readonly headerText?: string
  readonly bodyText: string
  readonly footerText?: string
}

export type CreateTemplateResult = {
  readonly id?: string
  readonly shortId: string
  readonly status: string
}

export type WhatsAppTemplateSummary = {
  readonly id: string
  readonly name: string
  readonly shortId: string
  readonly displayName: string
  readonly status: string
  readonly category: string
  readonly language: string
  readonly bodyText: string | null
  readonly variableCount: number
}

export type TemplateComponent = {
  readonly type: string
  readonly text?: string
  readonly format?: string
}

export type WhatsAppTemplateDetail = WhatsAppTemplateSummary & {
  readonly components: readonly TemplateComponent[]
}

export type DeleteTemplateParams = {
  readonly id: string
  readonly name: string
}

// ---- Catalog ----

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

export type WhatsAppCatalogSummary = {
  readonly id: string
  readonly name: string
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
