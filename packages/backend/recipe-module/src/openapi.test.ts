/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createRecipeRoutes } from './http/routes'
import { recipeOpenApiPaths } from './openapi'
import { buildTestModule } from './testing/buildTestModule'

const { module } = buildTestModule()
const routes = createRecipeRoutes({ module })

describe('recipeOpenApiPaths', () => {
  it('documenta TODA rota da tabela', () => {
    const paths = recipeOpenApiPaths({ routes, basePath: '/v1' })
    for (const route of routes) {
      const openApiPath = `/v1${route.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`
      const operation = (paths[openApiPath] as Record<string, { operationId: string }> | undefined)?.[
        route.method.toLowerCase()
      ]
      expect(operation?.operationId).toBe(route.operationId)
    }
  })

  it('operationIds únicos, tag recipes e nenhuma rota pública', () => {
    const ids = routes.map((route) => route.operationId)
    expect(new Set(ids).size).toBe(ids.length)
    expect((recipeOpenApiPaths({ routes })['/ingredients'] as Record<string, { tags: string[] }>).get?.tags).toEqual([
      'recipes',
    ])
    expect(routes.some((route) => route.scope === 'public')).toBe(false)
  })
})
