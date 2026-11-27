/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createCouponRoutes } from './http/routes'
import { couponOpenApiPaths } from './openapi'
import { buildTestModule } from './testing/buildTestModule'

const { module } = buildTestModule()
const routes = createCouponRoutes({
  module,
  public: {
    companyResolver: { resolve: async () => undefined },
    rateLimiter: { consume: async () => ({ allowed: true }) },
  },
})

describe('couponOpenApiPaths', () => {
  it('documenta TODA rota da tabela', () => {
    const paths = couponOpenApiPaths({ routes, basePath: '/v1' })
    for (const route of routes) {
      const openApiPath = `/v1${route.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`
      const operation = (paths[openApiPath] as Record<string, { operationId: string }> | undefined)?.[
        route.method.toLowerCase()
      ]
      expect(operation?.operationId).toBe(route.operationId)
    }
  })

  it('operationIds únicos e tag coupons', () => {
    const ids = routes.map((route) => route.operationId)
    expect(new Set(ids).size).toBe(ids.length)
    expect((couponOpenApiPaths({ routes })['/campaigns'] as Record<string, { tags: string[] }>).get?.tags).toEqual([
      'coupons',
    ])
  })

  it('sem limitador, nenhuma rota pública sobe', () => {
    expect(createCouponRoutes({ module }).some((route) => route.scope === 'public')).toBe(false)
  })
})
