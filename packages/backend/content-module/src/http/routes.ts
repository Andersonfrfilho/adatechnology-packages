/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ModuleRouteTable } from '@adatechnology/module-http'

import type { ContentModule } from '../ContentModule'
import { buildAdminRoutes } from './adminRoutes'
import { buildPublicRoutes, type PublicCompanyResolverPort } from './publicRoutes'

export type CreateContentRoutesParams = {
  readonly module: ContentModule
  /**
   * Como o site público diz de qual empresa é o blog (domínio, cabeçalho, valor fixo…). Ausente,
   * as rotas `/public/*` não sobem: o host que só tem painel não expõe leitura anônima.
   */
  readonly publicCompanyResolver?: PublicCompanyResolverPort
}

export function createContentRoutes(params: CreateContentRoutesParams): ModuleRouteTable {
  const admin = buildAdminRoutes(params.module)
  if (!params.publicCompanyResolver) return admin
  return [...admin, ...buildPublicRoutes({ module: params.module, companyResolver: params.publicCompanyResolver })]
}

export type { PublicCompanyResolverPort }
