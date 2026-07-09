import { assertConfigField } from '../shared/assertConfigField'
import { buildGraphUrl, graphFetch } from '../shared/graphFetch'
import {
  parseGraphResponse,
  idResponseSchema,
  catalogListResponseSchema,
  productDetailResponseSchema,
} from '../shared/graphResponseSchemas'
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

    const response = parseGraphResponse(
      idResponseSchema,
      await graphFetch({
        url: buildGraphUrl(
          this.config.apiVersion,
          `${this.resolveCatalogId(input.catalogId)}/products`,
          this.config.baseUrl,
        ),
        accessToken: this.config.accessToken,
        method: 'POST',
        jsonBody: payload,
      }),
    )

    return { id: response.id }
  }

  async updateProduct(params: UpdateCatalogProductParams): Promise<CatalogProductResult> {
    const payload = this.toProductPayload(params.input)

    await graphFetch({
      url: buildGraphUrl(this.config.apiVersion, params.productId, this.config.baseUrl),
      accessToken: this.config.accessToken,
      method: 'POST',
      jsonBody: payload,
    })

    return { id: params.productId }
  }

  async getProduct(productId: string): Promise<CatalogProductDetail> {
    const url = `${buildGraphUrl(this.config.apiVersion, productId, this.config.baseUrl)}?fields=id,retailer_id,name,description,price,currency,image_url,availability,condition,url,custom_label_0`
    const response = parseGraphResponse(
      productDetailResponseSchema,
      await graphFetch({ url, accessToken: this.config.accessToken }),
    )

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
      url: buildGraphUrl(this.config.apiVersion, productId, this.config.baseUrl),
      accessToken: this.config.accessToken,
      method: 'DELETE',
    })
  }

  async createProductSet(input: CatalogProductSetInput): Promise<CatalogProductSetResult> {
    const response = parseGraphResponse(
      idResponseSchema,
      await graphFetch({
        url: buildGraphUrl(
          this.config.apiVersion,
          `${this.resolveCatalogId(input.catalogId)}/product_sets`,
          this.config.baseUrl,
        ),
        accessToken: this.config.accessToken,
        method: 'POST',
        jsonBody: {
          name: input.name,
          filter: JSON.stringify({ custom_label_0: { eq: input.categoryLabel } }),
        },
      }),
    )

    return { id: response.id }
  }

  async updateProductSet(params: UpdateCatalogProductSetParams): Promise<CatalogProductSetResult> {
    await graphFetch({
      url: buildGraphUrl(this.config.apiVersion, params.productSetId, this.config.baseUrl),
      accessToken: this.config.accessToken,
      method: 'POST',
      jsonBody: { name: params.name },
    })

    return { id: params.productSetId }
  }

  async deleteProductSet(productSetId: string): Promise<void> {
    await graphFetch({
      url: buildGraphUrl(this.config.apiVersion, productSetId, this.config.baseUrl),
      accessToken: this.config.accessToken,
      method: 'DELETE',
    })
  }

  async listCatalogs(): Promise<readonly WhatsAppCatalogSummary[]> {
    const url = `${buildGraphUrl(this.config.apiVersion, `${this.wabaId}/product_catalogs`, this.config.baseUrl)}?fields=id,name`
    const response = parseGraphResponse(
      catalogListResponseSchema,
      await graphFetch({ url, accessToken: this.config.accessToken }),
    )

    return response.data.map((catalog) => ({ id: catalog.id, name: catalog.name }))
  }

  async createCatalog(params: CreateCatalogParams): Promise<CreateCatalogResult> {
    const response = parseGraphResponse(
      idResponseSchema,
      await graphFetch({
        url: buildGraphUrl(this.config.apiVersion, `${this.businessId}/owned_product_catalogs`, this.config.baseUrl),
        accessToken: this.config.accessToken,
        method: 'POST',
        jsonBody: { name: params.name, vertical: params.vertical ?? DEFAULT_CATALOG_VERTICAL },
      }),
    )

    return { id: response.id }
  }

  async updateCatalog(params: UpdateCatalogParams): Promise<void> {
    await graphFetch({
      url: buildGraphUrl(this.config.apiVersion, params.catalogId, this.config.baseUrl),
      accessToken: this.config.accessToken,
      method: 'POST',
      jsonBody: { name: params.name },
    })
  }

  async deleteCatalog(catalogId: string): Promise<void> {
    await graphFetch({
      url: buildGraphUrl(this.config.apiVersion, catalogId, this.config.baseUrl),
      accessToken: this.config.accessToken,
      method: 'DELETE',
    })
  }
}
