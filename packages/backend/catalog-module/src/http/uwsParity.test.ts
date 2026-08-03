/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Critério de aceite da §10: rotas prontas **nos dois adaptadores**.
 *
 * O teste de contrato do `module-http` prova que os adaptadores são equivalentes usando rotas
 * sintéticas. Este aqui roda as rotas **reais do catálogo** pelo uWS — porque equivalência
 * genérica não cobre detalhe específico destas rotas, como `listSections`, que lê
 * `context.query.catalogId` cru, sem `querySchema`, e portanto depende de cada adaptador montar
 * o objeto de query do mesmo jeito.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { createModuleFetchRouter } from '@adatechnology/module-http/fetch'
import { mountModuleRoutes } from '@adatechnology/module-http/uws'
import { createUwsHarness } from '@adatechnology/module-http/testing'
import type { AuthContextResolverPort } from '@adatechnology/module-http'

import { createCatalogRoutes } from './routes'
import type { CatalogModule } from '../CatalogModule'
import { CreateProductUseCase, ListProductsUseCase } from '../use-cases/Product.use-cases'
import { CreateSectionUseCase, ListSectionsUseCase } from '../use-cases/Catalog.use-cases'
import { createInMemoryCatalogs, createInMemoryProducts, createInMemorySections } from '../testing/inMemoryRepositories'
import type { CatalogDependencies } from '../use-cases/catalogModule.types'

const COMPANY_ID = randomUUID()
const CATALOG_ID = randomUUID()

function buildModule() {
  const dependencies = {
    products: createInMemoryProducts(),
    catalogs: createInMemoryCatalogs(),
    sections: createInMemorySections(),
    config: { currency: 'BRL', locale: 'pt-BR' },
  } as unknown as CatalogDependencies

  return {
    useCases: {
      createProduct: new CreateProductUseCase(dependencies),
      listProducts: new ListProductsUseCase(dependencies),
      createSection: new CreateSectionUseCase(dependencies),
      listSections: new ListSectionsUseCase(dependencies),
    },
  } as unknown as CatalogModule
}

const authResolver: AuthContextResolverPort = {
  async resolve() {
    return { companyId: COMPANY_ID, scopes: [] }
  },
}

/** Roda a mesma requisição lógica nos dois adaptadores e devolve os dois resultados. */
async function callBoth(params: { method: string; path: string; body?: unknown }) {
  const routes = createCatalogRoutes({ module: buildModule() })

  const fetchRouter = createModuleFetchRouter({ routes, basePath: '/v1', authResolver })
  const fetchResponse = await fetchRouter.handle(
    new Request(`http://localhost${params.path}`, {
      method: params.method,
      headers: params.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: params.body === undefined ? undefined : JSON.stringify(params.body),
    }),
  )
  const fetchText = await fetchResponse.text()

  const harness = createUwsHarness()
  mountModuleRoutes({ app: harness.app, routes, basePath: '/v1', authResolver })
  const uwsResult = await harness.call({ method: params.method, path: params.path, body: params.body })

  return {
    fetch: { status: fetchResponse.status, body: fetchText === '' ? undefined : JSON.parse(fetchText) },
    uws: uwsResult,
  }
}

describe('rotas reais do catálogo — paridade entre fetch e uws', () => {
  it('listar produtos devolve o mesmo status e envelope', async () => {
    const { fetch, uws } = await callBoth({ method: 'GET', path: '/v1/products' })

    expect(uws.status).toBe(fetch.status)
    expect(uws.body).toEqual(fetch.body)
    expect(fetch.status).toBe(200)
  })

  it('criar produto devolve 201 e o mesmo corpo nos dois', async () => {
    const body = { name: 'Pão de forma', priceInCents: 890 }
    const { fetch, uws } = await callBoth({ method: 'POST', path: '/v1/products', body })

    expect(fetch.status).toBe(201)
    expect(uws.status).toBe(201)
    // Ids são gerados, então compara a forma, não o valor.
    expect(Object.keys((uws.body as { data: object }).data).sort()).toEqual(
      Object.keys((fetch.body as { data: object }).data).sort(),
    )
  })

  it('validação inválida devolve 400 idêntico nos dois', async () => {
    const { fetch, uws } = await callBoth({
      method: 'POST',
      path: '/v1/products',
      body: { name: '', priceInCents: -1 },
    })

    expect(fetch.status).toBe(400)
    expect(uws.status).toBe(400)
    expect((uws.body as { error: { code: string } }).error.code).toBe(
      (fetch.body as { error: { code: string } }).error.code,
    )
  })

  it('query string crua chega igual — é o caso que a rota de seções depende', async () => {
    // `listSections` lê `context.query.catalogId` sem querySchema: se um adaptador montasse o
    // objeto de query diferente, esta rota se comportaria diferente em cada transporte.
    const { fetch, uws } = await callBoth({ method: 'GET', path: `/v1/sections?catalogId=${CATALOG_ID}` })

    expect(uws.status).toBe(fetch.status)
    expect(uws.body).toEqual(fetch.body)
  })

  it('rota inexistente devolve 404 nos dois', async () => {
    const { fetch, uws } = await callBoth({ method: 'GET', path: '/v1/nao-existe' })

    expect(fetch.status).toBe(404)
    expect(uws.status).toBe(404)
  })
})
