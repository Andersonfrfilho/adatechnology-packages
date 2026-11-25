/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createContentRoutes } from './http/routes'
import { contentOpenApiPaths } from './openapi'
import { buildTestModule } from './testing/buildTestModule'

const { module } = buildTestModule({
  config: { feed: { siteUrl: 'https://example.com', title: 'Blog' } },
  imageStorage: { upload: async ({ key }) => ({ url: key, key }) },
})
const routes = createContentRoutes({ module, publicCompanyResolver: { resolve: async () => undefined } })

describe('contentOpenApiPaths', () => {
  it('documenta TODA rota da tabela', () => {
    const paths = contentOpenApiPaths({ routes, basePath: '/v1' })
    for (const route of routes) {
      const openApiPath = `/v1${route.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`
      const operation = (paths[openApiPath] as Record<string, { operationId: string }> | undefined)?.[
        route.method.toLowerCase()
      ]
      expect(operation?.operationId).toBe(route.operationId)
    }
  })

  it('operationIds são únicos e a tag é content', () => {
    const ids = routes.map((route) => route.operationId)
    expect(new Set(ids).size).toBe(ids.length)
    const paths = contentOpenApiPaths({ routes })
    expect((paths['/posts'] as Record<string, { tags: string[] }>).get?.tags).toEqual(['content'])
  })

  it('rotas fixas vêm antes das com parâmetro (`/posts/tags` antes de `/posts/:id`)', () => {
    const paths = routes.map((route) => route.path)
    expect(paths.indexOf('/posts/tags')).toBeLessThan(paths.indexOf('/posts/:id'))
    expect(paths.indexOf('/posts/cover-images')).toBeLessThan(paths.indexOf('/posts/:id'))
  })
})
