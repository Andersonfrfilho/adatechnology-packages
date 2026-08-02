/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { MetaSyncConfig } from '@adatechnology/catalog-contracts'
import type { ModuleRouteTable } from '@adatechnology/module-http'

import type { CatalogModule } from '../CatalogModule'
import { buildCatalogRoutes } from './catalogRoutes'
import { buildProductRoutes } from './productRoutes'
import { buildSyncRoutes } from './syncRoutes'

export type CreateCatalogRoutesParams = {
  readonly module: CatalogModule
  /**
   * Espelha o `metaSync` da config do módulo. Desligado (o padrão), as rotas de publicação **não
   * são montadas** — não é só esconder botão: a rota nem existe para ser chamada.
   */
  readonly metaSync?: MetaSyncConfig
}

export function createCatalogRoutes(params: CreateCatalogRoutesParams): ModuleRouteTable {
  const routes = [...buildProductRoutes(params.module), ...buildCatalogRoutes(params.module)]

  const syncEnabled = params.metaSync?.products || params.metaSync?.catalogs
  return syncEnabled ? [...routes, ...buildSyncRoutes(params.module)] : routes
}
