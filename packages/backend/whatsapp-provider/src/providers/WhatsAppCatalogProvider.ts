import { assertConfigField } from '../shared/assertConfigField'
import { buildGraphUrl, graphFetch } from '../shared/graphFetch'
import type {
  WhatsAppProviderConfig,
  CatalogProductInput,
  UpdateCatalogProductParams,
  CatalogProductResult,
  CatalogProductDetail,
  CatalogProductSetInput,
  UpdateCatalogProductSetParams,
  CatalogProductSetResult,
  WhatsAppCatalogSummary,
  CreateCatalogParams,
  CreateCatalogResult,
  UpdateCatalogParams,
} from '../types'

const DEFAULT_AVAILABILITY = 'in stock'
const DEFAULT_CONDITION = 'new'
const DEFAULT_CATALOG_VERTICAL = 'commerce'

export class WhatsAppCatalogProvider {
  constructor(private readonly config: WhatsAppProviderConfig) {}

  private resolveCatalogId(override?: string): string {
    return assertConfigField(override ?? this.config.catalogId, 'catalogId')
  }

  private get wabaId(): string {
    return assertConfigField(this.config.wabaId, 'wabaId')
  }

  private get businessId(): string {
    return assertConfigField(this.config.businessId, 'businessId')
  }

  private toProductPayload(input: Partial<CatalogProductInput>): Record<string, unknown> {
    const payload: Record<string, unknown> = {}
    if (input.retailerId !== undefined) payload['retailer_id'] = input.retailerId
    if (input.name !== undefined) payload['name'] = input.name
    if (input.description !== undefined) payload['description'] = input.description
    if (input.priceInCents !== undefined) payload['price'] = input.priceInCents
    if (input.currency !== undefined) payload['currency'] = input.currency
    if (input.imageUrl !== undefined) payload['image_url'] = input.imageUrl
    if (input.categoryLabel !== undefined) payload['custom_label_0'] = input.categoryLabel
    if (input.availability !== undefined) payload['availability'] = input.availability
    if (input.condition !== undefined) payload['condition'] = input.condition
    if (input.url !== undefined) payload['url'] = input.url
    return payload
  }

  async createProduct(input: CatalogProductInput): Promise<CatalogProductResult> {
    const payload = this.toProductPayload({
      ...input,
      availability: input.availability ?? DEFAULT_AVAILABILITY,
      condition: input.condition ?? DEFAULT_CONDITION,
    })

    const response = (await graphFetch({
      url: buildGraphUrl(this.config.apiVersion, `${this.resolveCatalogId(input.catalogId)}/products`),
      accessToken: this.config.accessToken,
      method: 'POST',
      jsonBody: payload,
    })) as { id: string }

    return { id: response.id }
  }

  async updateProduct(params: UpdateCatalogProductParams): Promise<CatalogProductResult> {
    const payload = this.toProductPayload(params.input)

    await graphFetch({
      url: buildGraphUrl(this.config.apiVersion, params.productId),
      accessToken: this.config.accessToken,
      method: 'POST',
      jsonBody: payload,
    })

    return { id: params.productId }
  }

  async getProduct(productId: string): Promise<CatalogProductDetail> {
    const url = `${buildGraphUrl(this.config.apiVersion, productId)}?fields=id,retailer_id,name,description,price,currency,image_url,availability,condition,url,custom_label_0`
    const response = (await graphFetch({ url, accessToken: this.config.accessToken })) as {
      id: string
      retailer_id: string
      name: string
      description: string
      price: number
      currency: string
      image_url: string
      availability: CatalogProductInput['availability']
      condition: CatalogProductInput['condition']
      url?: string
      custom_label_0: string
    }

    return {
      id: response.id,
      retailerId: response.retailer_id,
      name: response.name,
      description: response.description,
      priceInCents: response.price,
      currency: response.currency,
      imageUrl: response.image_url,
      categoryLabel: response.custom_label_0,
      availability: response.availability,
      condition: response.condition,
      url: response.url,
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    await graphFetch({
      url: buildGraphUrl(this.config.apiVersion, productId),
      accessToken: this.config.accessToken,
      method: 'DELETE',
    })
  }

  async createProductSet(input: CatalogProductSetInput): Promise<CatalogProductSetResult> {
    const response = (await graphFetch({
      url: buildGraphUrl(this.config.apiVersion, `${this.resolveCatalogId(input.catalogId)}/product_sets`),
      accessToken: this.config.accessToken,
      method: 'POST',
      jsonBody: {
        name: input.name,
        filter: JSON.stringify({ custom_label_0: { eq: input.categoryLabel } }),
      },
    })) as { id: string }

    return { id: response.id }
  }

  async updateProductSet(params: UpdateCatalogProductSetParams): Promise<CatalogProductSetResult> {
    await graphFetch({
      url: buildGraphUrl(this.config.apiVersion, params.productSetId),
      accessToken: this.config.accessToken,
      method: 'POST',
      jsonBody: { name: params.name },
    })

    return { id: params.productSetId }
  }

  async deleteProductSet(productSetId: string): Promise<void> {
    await graphFetch({
      url: buildGraphUrl(this.config.apiVersion, productSetId),
      accessToken: this.config.accessToken,
      method: 'DELETE',
    })
  }

  async listCatalogs(): Promise<readonly WhatsAppCatalogSummary[]> {
    const url = `${buildGraphUrl(this.config.apiVersion, `${this.wabaId}/product_catalogs`)}?fields=id,name`
    const response = (await graphFetch({ url, accessToken: this.config.accessToken })) as {
      data: readonly { id: string; name: string }[]
    }

    return response.data.map((catalog) => ({ id: catalog.id, name: catalog.name }))
  }

  async createCatalog(params: CreateCatalogParams): Promise<CreateCatalogResult> {
    const response = (await graphFetch({
      url: buildGraphUrl(this.config.apiVersion, `${this.businessId}/owned_product_catalogs`),
      accessToken: this.config.accessToken,
      method: 'POST',
      jsonBody: { name: params.name, vertical: params.vertical ?? DEFAULT_CATALOG_VERTICAL },
    })) as { id: string }

    return { id: response.id }
  }

  async updateCatalog(params: UpdateCatalogParams): Promise<void> {
    await graphFetch({
      url: buildGraphUrl(this.config.apiVersion, params.catalogId),
      accessToken: this.config.accessToken,
      method: 'POST',
      jsonBody: { name: params.name },
    })
  }

  async deleteCatalog(catalogId: string): Promise<void> {
    await graphFetch({
      url: buildGraphUrl(this.config.apiVersion, catalogId),
      accessToken: this.config.accessToken,
      method: 'DELETE',
    })
  }
}
