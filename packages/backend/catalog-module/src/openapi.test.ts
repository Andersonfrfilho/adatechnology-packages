/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { catalogOpenApiPaths } from './openapi'
import { createCatalogRoutes } from './http/routes'
import type { CatalogModule } from './CatalogModule'

const routes = createCatalogRoutes({ module: { useCases: {} } as unknown as CatalogModule })

describe('catalogOpenApiPaths', () => {
  it('documenta TODA rota da tabela — rota nova sem path no spec quebra aqui', () => {
    const paths = catalogOpenApiPaths({ routes, basePath: '/v1' })

    for (const route of routes) {
      const openApiPath = `/v1${route.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`
      const operation = (paths[openApiPath] as Record<string, unknown> | undefined)?.[route.method.toLowerCase()]

      expect(operation).toBeDefined()
      expect((operation as { operationId: string }).operationId).toBe(route.operationId)
    }
  })

  it('converte parâmetro de rota para o formato do OpenAPI', () => {
    const paths = catalogOpenApiPaths({ routes, basePath: '/v1' })

    expect(paths['/v1/products/{id}']).toBeDefined()
    expect(paths['/v1/products/:id']).toBeUndefined()
  })

  it('agrupa métodos diferentes sob o mesmo path', () => {
    const paths = catalogOpenApiPaths({ routes, basePath: '/v1' })

    expect(Object.keys(paths['/v1/products'] as object).sort()).toEqual(['get', 'post'])
    expect(Object.keys(paths['/v1/products/{id}'] as object).sort()).toEqual(['delete', 'get', 'put'])
  })

  it('marca a tag do módulo, para o Swagger do host agrupar', () => {
    const paths = catalogOpenApiPaths({ routes, basePath: '/v1' })
    const listProducts = (paths['/v1/products'] as Record<string, Record<string, unknown>>).get

    expect(listProducts?.tags).toEqual(['catalog'])
  })

  it('declara 404 em rota com parâmetro, onde "de outra empresa" e "inexistente" se confundem', () => {
    const paths = catalogOpenApiPaths({ routes, basePath: '/v1' })
    const getProduct = (paths['/v1/products/{id}'] as Record<string, Record<string, unknown>>).get

    expect(Object.keys(getProduct?.responses as object)).toContain('404')
  })
})
