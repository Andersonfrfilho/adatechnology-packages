/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/**
 * Escopos padrão das rotas administrativas do catálogo. Leitura (`GET`) aceita `read` ou `write`
 * — quem edita também lê —, e toda mutação exige `write`. O host troca o vocabulário em
 * `createCatalogRoutes({ scopes })` se o dele for outro.
 */
export const CATALOG_SCOPE = {
  READ: 'catalog:read',
  WRITE: 'catalog:write',
} as const
export type CatalogScope = (typeof CATALOG_SCOPE)[keyof typeof CATALOG_SCOPE]

export type CatalogRouteScopes = {
  /** Escopos que liberam as rotas `GET`. Basta um. */
  readonly read?: readonly string[]
  /** Escopos que liberam as mutações. Basta um. */
  readonly write?: readonly string[]
}

export const DEFAULT_CATALOG_ROUTE_SCOPES = {
  read: [CATALOG_SCOPE.READ, CATALOG_SCOPE.WRITE],
  write: [CATALOG_SCOPE.WRITE],
} as const satisfies Required<CatalogRouteScopes>
