/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { MetaSyncConfig } from '@adatechnology/catalog-contracts'
import type { ModuleRoute, ModuleRouteTable } from '@adatechnology/module-http'

import type { CatalogModule } from '../CatalogModule'
import { buildCatalogRoutes } from './catalogRoutes'
import { buildProductRoutes } from './productRoutes'
import { buildCatalogWebhookRoutes } from './webhookRoutes'
import { buildSyncRoutes } from './syncRoutes'
import { DEFAULT_CATALOG_ROUTE_SCOPES, type CatalogRouteScopes } from './catalogScope.constant'

export type CreateCatalogRoutesParams = {
  readonly module: CatalogModule
  /**
   * Espelha o `metaSync` da config do módulo. Desligado (o padrão), as rotas de publicação **não
   * são montadas** — não é só esconder botão: a rota nem existe para ser chamada.
   */
  readonly metaSync?: MetaSyncConfig
  /**
   * Escopos exigidos nas rotas `admin`. Padrão: `catalog:read` (ou `catalog:write`) para `GET` e
   * `catalog:write` para mutações. Lista vazia aceita qualquer identidade com algum escopo.
   */
  readonly scopes?: CatalogRouteScopes
}

function withRequiredScopes(routes: readonly ModuleRoute[], scopes: CatalogRouteScopes | undefined): ModuleRoute[] {
  const read = scopes?.read ?? DEFAULT_CATALOG_ROUTE_SCOPES.read
  const write = scopes?.write ?? DEFAULT_CATALOG_ROUTE_SCOPES.write
  return routes.map((route) =>
    route.scope === 'admin' ? { ...route, requiredScopes: route.method === 'GET' ? read : write } : route,
  )
}

export function createCatalogRoutes(params: CreateCatalogRoutesParams): ModuleRouteTable {
  const routes = [
    ...buildProductRoutes(params.module),
    ...buildCatalogRoutes(params.module),
    // Fail-closed: sem `config.webhook` o array volta vazio e a URL simplesmente não existe.
    ...buildCatalogWebhookRoutes(params.module),
  ]

  const syncEnabled = params.metaSync?.products || params.metaSync?.catalogs
  const mounted = syncEnabled ? [...routes, ...buildSyncRoutes(params.module)] : routes
  return withRequiredScopes(mounted, params.scopes)
}
