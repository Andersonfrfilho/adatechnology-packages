/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { CatalogModuleApiError, createCatalogModuleProductsApi } from './createCatalogModuleProductsApi'

type Call = { url: string; init: RequestInit }

function fakeFetch(respond: (call: Call) => Response) {
  const calls: Call[] = []
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const call = { url, init }
    calls.push(call)
    return respond(call)
  }) as unknown as typeof fetch
  return { calls, fetchImpl }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('createCatalogModuleProductsApi', () => {
  it('converte { data, pagination } no formato da tela e manda o cabeçalho do host', async () => {
    const { calls, fetchImpl } = fakeFetch(() =>
      json({
        data: [{ id: 'p1', name: 'Suco', catalogName: 'Bebidas' }],
        pagination: { total: 1, page: 2, pageSize: 10, totalPages: 1 },
      }),
    )
    const api = createCatalogModuleProductsApi({
      baseUrl: '/v1/catalog',
      fetch: fetchImpl,
      pageSize: 10,
      getHeaders: () => ({ authorization: 'Bearer t' }),
    })

    const page = await api.listProducts({ page: 2, search: 'suco' })

    expect(page).toEqual({
      data: [{ id: 'p1', name: 'Suco', catalogName: 'Bebidas' } as never],
      total: 1,
      page: 2,
      pageSize: 10,
      totalPages: 1,
    })
    expect(calls[0]?.url).toBe('/v1/catalog/products?page=2&search=suco&pageSize=10')
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBe('Bearer t')
  })

  it('desembrulha { data } e trata 204', async () => {
    const { calls, fetchImpl } = fakeFetch((call) =>
      call.init.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : json({ data: { id: 'c1', productCount: 3 } }),
    )
    const api = createCatalogModuleProductsApi({ baseUrl: '/v1', fetch: fetchImpl })

    expect((await api.getCatalog('c1')).productCount).toBe(3)
    await expect(api.deleteCatalog('c1')).resolves.toBeUndefined()
    expect(calls.map((call) => call.url)).toEqual(['/v1/catalogs/c1', '/v1/catalogs/c1'])
  })

  it('erro da API vira CatalogModuleApiError com o code do envelope', async () => {
    const { fetchImpl } = fakeFetch(() => json({ error: { code: 'FORBIDDEN', message: 'Acesso negado.' } }, 403))
    const api = createCatalogModuleProductsApi({ baseUrl: '/v1', fetch: fetchImpl })

    const failure = await api.getProduct('x').catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(CatalogModuleApiError)
    expect(failure).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('importação em lote manda linhas lidas do CSV, não o arquivo', async () => {
    const { calls, fetchImpl } = fakeFetch(() => json({ data: { succeeded: 1, failed: 0, errors: [] } }))
    const api = createCatalogModuleProductsApi({ baseUrl: '/v1', fetch: fetchImpl })
    const file = new File(['Nome,Preço,Catálogo\nSuco,"9,90",Bebidas\n'], 'p.csv', { type: 'text/csv' })

    await api.bulkImportProducts(file)

    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      rows: [{ name: 'Suco', price: '9,90', catalogName: 'Bebidas' }],
    })
  })

  it('upload de imagem só existe quando ligado', () => {
    const { fetchImpl } = fakeFetch(() => json({}))
    expect(createCatalogModuleProductsApi({ baseUrl: '/v1', fetch: fetchImpl }).uploadImage).toBeUndefined()
    expect(
      createCatalogModuleProductsApi({ baseUrl: '/v1', fetch: fetchImpl, imageUpload: true }).uploadImage,
    ).toBeDefined()
  })
})
