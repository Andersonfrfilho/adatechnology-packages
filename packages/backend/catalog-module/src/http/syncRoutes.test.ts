/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * T3.5 — as rotas de publicação **não existem** quando `metaSync` está desligado. Não é esconder
 * botão na UI: a rota não é montada, e chamá-la devolve 404 como qualquer caminho inexistente.
 */

import { describe, expect, it } from 'bun:test'

import { createCatalogRoutes } from './routes'
import type { CatalogModule } from '../CatalogModule'

const stubModule = { useCases: {} } as unknown as CatalogModule
const SYNC_OPERATIONS = ['syncProductToMeta', 'syncCatalogToMeta', 'syncPendingToMeta', 'retryFailedSyncs']

describe('rotas de sync são condicionais ao metaSync', () => {
  it('sem metaSync, nenhuma rota de publicação entra na tabela', () => {
    const routes = createCatalogRoutes({ module: stubModule })
    const operations = routes.map((route) => route.operationId)

    for (const operation of SYNC_OPERATIONS) expect(operations).not.toContain(operation)
    expect(routes.some((route) => route.path.includes('/sync'))).toBe(false)
  })

  it('metaSync desligado explicitamente também não monta', () => {
    const routes = createCatalogRoutes({ module: stubModule, metaSync: { products: false, catalogs: false } })

    expect(routes.some((route) => route.path.includes('/sync'))).toBe(false)
  })

  it('com produtos ligados, as quatro rotas de publicação aparecem', () => {
    const routes = createCatalogRoutes({ module: stubModule, metaSync: { products: true, catalogs: false } })
    const operations = routes.map((route) => route.operationId)

    for (const operation of SYNC_OPERATIONS) expect(operations).toContain(operation)
  })

  it('as rotas de CRUD são as mesmas nos dois casos — ligar sync não muda o resto', () => {
    const without = createCatalogRoutes({ module: stubModule }).map((route) => route.operationId)
    const withSync = createCatalogRoutes({ module: stubModule, metaSync: { products: true, catalogs: true } }).map(
      (route) => route.operationId,
    )

    expect(withSync.filter((operation) => !SYNC_OPERATIONS.includes(operation))).toEqual(without)
  })
})
