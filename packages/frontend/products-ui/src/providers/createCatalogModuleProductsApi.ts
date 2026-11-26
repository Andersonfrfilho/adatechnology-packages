/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * `ProductsApi` pronto para as rotas do `@adatechnology/catalog-module`. Sem ele cada host
 * reescrevia a mesma ponte — e errava o envelope: o módulo responde `{ data, pagination }`, a tela
 * espera `{ data, total, page, pageSize, totalPages }`.
 */

import { parseBulkImportCsv } from '../lib/csv'
import type {
  BulkImportResult,
  Catalog,
  ListProductsParams,
  PaginatedResponse,
  Product,
  ProductsApi,
  ProductsBatchResult,
} from './types'

export const CATALOG_MODULE_DEFAULT_PAGE_SIZE = 50

export type CreateCatalogModuleProductsApiParams = {
  /** Onde o host montou `createCatalogRoutes`, ex.: `/v1/catalog`. Sem barra no fim. */
  readonly baseUrl: string
  /** Cabeçalhos por requisição (o `Authorization` do host). Chamado a cada request. */
  readonly getHeaders?: () => Record<string, string> | Promise<Record<string, string>>
  readonly fetch?: typeof fetch
  readonly pageSize?: number
  /**
   * Liga `uploadImage`. Só ligue se o módulo foi montado com storage de imagem: sem ele a rota
   * `POST /products/images` não existe, e a tela mostraria um alvo de upload que sempre falha.
   */
  readonly imageUpload?: boolean
  /** Lê o arquivo da importação em lote. Padrão: CSV com cabeçalho (`parseBulkImportCsv`). */
  readonly parseBulkImportFile?: (file: File) => Promise<readonly Record<string, unknown>[]>
}

/** Erro devolvido pela API, com o `code` estável do envelope `{ error: { code, message } }`. */
export class CatalogModuleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message)
    this.name = 'CatalogModuleApiError'
  }
}

type ModulePage<TItem> = {
  readonly data: readonly TItem[]
  readonly pagination: {
    readonly total: number
    readonly page: number
    readonly pageSize: number
    readonly totalPages: number
  }
}

type RequestOptions = {
  readonly method?: string
  readonly query?: Readonly<Record<string, string | number | boolean | undefined>>
  readonly json?: unknown
  readonly blob?: Blob
}

function buildQuery(query: RequestOptions['query']): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

async function toApiError(response: Response): Promise<CatalogModuleApiError> {
  const body = (await response.json().catch(() => undefined)) as
    { error?: { code?: string; message?: string } } | undefined
  return new CatalogModuleApiError(
    body?.error?.message ?? `Falha na API de catálogo (${response.status})`,
    response.status,
    body?.error?.code ?? 'HTTP_ERROR',
  )
}

/** Vetores viram lista separada por vírgula (`catalogIds=a,b`), que é o formato do contrato. */
function toProductsQuery(query: ListProductsParams | undefined): NonNullable<RequestOptions['query']> {
  const { catalogIds, sectionIds, ...rest } = query ?? {}
  return {
    ...rest,
    ...(catalogIds?.length ? { catalogIds: catalogIds.join(',') } : {}),
    ...(sectionIds?.length ? { sectionIds: sectionIds.join(',') } : {}),
  }
}

function countSettled(results: readonly PromiseSettledResult<unknown>[]): ProductsBatchResult {
  const succeeded = results.filter((result) => result.status === 'fulfilled').length
  return { succeeded, failed: results.length - succeeded }
}

function toPaginated<TItem>(page: ModulePage<TItem>): PaginatedResponse<TItem> {
  return { data: page.data, ...page.pagination }
}

export function createCatalogModuleProductsApi(params: CreateCatalogModuleProductsApiParams): ProductsApi {
  const fetchImpl = params.fetch ?? globalThis.fetch.bind(globalThis)
  const pageSize = params.pageSize ?? CATALOG_MODULE_DEFAULT_PAGE_SIZE
  const parseBulkImportFile =
    params.parseBulkImportFile ?? (async (file: File) => parseBulkImportCsv(await file.text()))

  async function request<TResult>(path: string, options: RequestOptions = {}): Promise<TResult> {
    const headers: Record<string, string> = { ...(await params.getHeaders?.()) }
    let body: BodyInit | undefined
    if (options.json !== undefined) {
      headers['content-type'] = 'application/json'
      body = JSON.stringify(options.json)
    } else if (options.blob) {
      headers['content-type'] = options.blob.type
      body = options.blob
    }

    const response = await fetchImpl(`${params.baseUrl}${path}${buildQuery(options.query)}`, {
      method: options.method ?? 'GET',
      headers,
      body,
    })
    if (!response.ok) throw await toApiError(response)
    if (response.status === 204) return undefined as TResult
    return (await response.json()) as TResult
  }

  async function requestData<TResult>(path: string, options?: RequestOptions): Promise<TResult> {
    return (await request<{ data: TResult }>(path, options)).data
  }

  const productPath = (id: string): string => `/products/${encodeURIComponent(id)}`
  const catalogPath = (id: string): string => `/catalogs/${encodeURIComponent(id)}`

  const api: ProductsApi = {
    listProducts: async (query) =>
      toPaginated(
        await request<ModulePage<Product>>('/products', {
          query: { ...toProductsQuery(query), page: query?.page ?? 1, pageSize: query?.pageSize ?? pageSize },
        }),
      ),
    getProduct: (id) => requestData<Product>(productPath(id)),
    createProduct: (data) => requestData<Product>('/products', { method: 'POST', json: data }),
    updateProduct: (id, data) => requestData<Product>(productPath(id), { method: 'PUT', json: data }),
    deleteProduct: (id) => request<void>(productPath(id), { method: 'DELETE' }),
    // Sem rota de lote no módulo: cada item é uma chamada, e uma falha não cancela as demais.
    updateProducts: async (ids, data) =>
      countSettled(await Promise.allSettled(ids.map((id) => request(productPath(id), { method: 'PUT', json: data })))),
    deleteProducts: async (ids) =>
      countSettled(await Promise.allSettled(ids.map((id) => request<void>(productPath(id), { method: 'DELETE' })))),

    listCatalogs: async (query) =>
      toPaginated(
        await request<ModulePage<Catalog>>('/catalogs', { query: { ...query, page: query?.page ?? 1, pageSize } }),
      ),
    getCatalog: (id) => requestData<Catalog>(catalogPath(id)),
    createCatalog: (data) => requestData<Catalog>('/catalogs', { method: 'POST', json: data }),
    updateCatalog: (id, data) => requestData<Catalog>(catalogPath(id), { method: 'PUT', json: data }),
    deleteCatalog: (id) => request<void>(catalogPath(id), { method: 'DELETE' }),

    bulkImportProducts: async (file) =>
      requestData<BulkImportResult>('/products/bulk-import', {
        method: 'POST',
        json: { rows: await parseBulkImportFile(file) },
      }),
  }

  if (!params.imageUpload) return api
  return {
    ...api,
    uploadImage: (file) =>
      requestData<{ readonly url: string; readonly key: string }>('/products/images', { method: 'POST', blob: file }),
  }
}
