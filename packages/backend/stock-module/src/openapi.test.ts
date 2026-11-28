/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createStockRoutes } from './http/routes'
import { stockOpenApiPaths } from './openapi'
import { buildTestModule } from './testing/buildTestModule'

const { module } = buildTestModule()
const routes = createStockRoutes({ module })

describe('stockOpenApiPaths', () => {
  it('documenta TODA rota da tabela', () => {
    const paths = stockOpenApiPaths({ routes, basePath: '/v1' })
    for (const route of routes) {
      const openApiPath = `/v1${route.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`
      const operation = (paths[openApiPath] as Record<string, { operationId: string }> | undefined)?.[
        route.method.toLowerCase()
      ]
      expect(operation?.operationId).toBe(route.operationId)
    }
  })

  it('operationIds únicos, tag stock e nenhuma rota pública', () => {
    const ids = routes.map((route) => route.operationId)
    expect(new Set(ids).size).toBe(ids.length)
    expect((stockOpenApiPaths({ routes })['/levels'] as Record<string, { tags: string[] }>).get?.tags).toEqual([
      'stock',
    ])
    expect(routes.some((route) => route.scope === 'public')).toBe(false)
  })
})
