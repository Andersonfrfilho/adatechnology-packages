/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { RateLimiterPort } from '@adatechnology/coupon-contracts'
import type { ModuleRouteTable } from '@adatechnology/module-http'

import type { CouponModule } from '../CouponModule'
import { buildAdminRoutes } from './adminRoutes'
import { buildPublicRoutes, type PublicCompanyResolverPort } from './publicRoutes'
import { buildServiceRoutes } from './serviceRoutes'

export type CreateCouponRoutesParams = {
  readonly module: CouponModule
  /**
   * Rotas do site. Sobem só com as duas portas: sem limitador, validar código anônimo é força
   * bruta e captar lead é spam de e-mail em nome da empresa (fail-closed).
   */
  readonly public?: {
    readonly companyResolver: PublicCompanyResolverPort
    readonly rateLimiter: RateLimiterPort
  }
}

export function createCouponRoutes(params: CreateCouponRoutesParams): ModuleRouteTable {
  const routes = [...buildAdminRoutes(params.module), ...buildServiceRoutes(params.module)]
  if (!params.public) return routes
  return [...routes, ...buildPublicRoutes({ module: params.module, ...params.public })]
}

export type { PublicCompanyResolverPort }
