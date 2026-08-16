import type { z } from 'zod'

import {
  assertConfigField,
  buildGraphUrl,
  graphFetch,
  parseGraphResponse,
  idResponseSchema,
  catalogListResponseSchema,
  productListResponseSchema,
  productDetailResponseSchema,
} from '@adatechnology/meta-graph-core'
import type {
  MetaCatalogProviderConfig,
  CatalogProductInput,
  UpdateCatalogProductParams,
  CatalogProductResult,
  CatalogProductDetail,
  CatalogProductSetInput,
  UpdateCatalogProductSetParams,
  CatalogProductSetResult,
  CatalogSummary,
  CatalogProductSummary,
  ListCatalogProductsParams,
  CreateCatalogParams,
  CreateCatalogResult,
  UpdateCatalogParams,
} from './types'

const DEFAULT_AVAILABILITY = 'in stock'
const DEFAULT_CONDITION = 'new'
const DEFAULT_CATALOG_VERTICAL = 'commerce'
// Anotado à mão: sem isso o `url` reatribuído a partir de `paging.next` cria uma inferência
// circular entre a resposta e a própria URL que a produziu.
type ProductListResponse = z.infer<typeof productListResponseSchema>

const PRODUCT_PAGE_SIZE = 100
const MAXIMUM_PRODUCT_PAGES = 20

export class MetaCatalogProvider {
  constructor(private readonly config: MetaCatalogProviderConfig) {}

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
    if (input.inventory !== undefined) payload['inventory'] = input.inventory
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
    const url = `${buildGraphUrl(this.config.apiVersion, productId, this.config.baseUrl)}?fields=id,retailer_id,name,description,price,currency,image_url,availability,condition,url,custom_label_0,inventory`
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
      ...(response.inventory !== undefined ? { inventory: response.inventory } : {}),
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

  async listCatalogs(): Promise<readonly CatalogSummary[]> {
    const url = `${buildGraphUrl(this.config.apiVersion, `${this.wabaId}/product_catalogs`, this.config.baseUrl)}?fields=id,name`
    const response = parseGraphResponse(
      catalogListResponseSchema,
      await graphFetch({ url, accessToken: this.config.accessToken }),
    )

    return response.data.map((catalog) => ({ id: catalog.id, name: catalog.name }))
  }

  /**
   * Lista os itens do catálogo, seguindo a paginação do Graph.
   *
   * Existe para reconciliação: comparar o que está gravado localmente com o que a conta realmente
   * tem. `getProduct` responderia a mesma pergunta uma linha por vez, o que numa listagem vira
   * dezenas de chamadas e esbarra em rate limit.
   *
   * O teto de páginas evita que um catálogo grande transforme uma checagem de tela em varredura
   * indefinida; quem precisa de tudo pagina do lado de fora.
   */
  async listProducts(params: ListCatalogProductsParams = {}): Promise<readonly CatalogProductSummary[]> {
    const products: CatalogProductSummary[] = []
    let url: string | undefined = `${buildGraphUrl(
      this.config.apiVersion,
      `${this.resolveCatalogId(params.catalogId)}/products`,
      this.config.baseUrl,
    )}?fields=id,retailer_id,name&limit=${PRODUCT_PAGE_SIZE}`

    for (let page = 0; page < MAXIMUM_PRODUCT_PAGES && url; page += 1) {
      const response: ProductListResponse = parseGraphResponse(
        productListResponseSchema,
        await graphFetch({ url, accessToken: this.config.accessToken }),
      )
      for (const product of response.data) {
        products.push({ id: product.id, retailerId: product.retailer_id, name: product.name })
      }
      url = response.paging?.next
    }

    return products
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
