/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ModuleRouteTable } from '@adatechnology/module-http'

import type { CatalogModule } from '../CatalogModule'
import { buildCatalogRoutes } from './catalogRoutes'
import { buildProductRoutes } from './productRoutes'

export type CreateCatalogRoutesParams = {
  readonly module: CatalogModule
}

/**
 * As rotas de publicação na Meta **não estão aqui** — elas nascem na Fase 4, junto com os
 * use-cases de sync. O filtro por `metaSync` entra com elas: publicar rota de sincronização para
 * quem não sincroniza exporia botão que não faz nada.
 */
export function createCatalogRoutes(params: CreateCatalogRoutesParams): ModuleRouteTable {
  return [...buildProductRoutes(params.module), ...buildCatalogRoutes(params.module)]
}
