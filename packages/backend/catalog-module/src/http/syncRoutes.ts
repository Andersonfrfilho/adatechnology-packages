/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rotas de publicação na Meta. **Só entram na tabela quando `metaSync` está ligado** — publicar
 * rota de sincronização para quem não sincroniza exporia botão que não faz nada, e a vertical que
 * não vende por WhatsApp não deveria nem saber que isso existe.
 */

import type { ModuleRoute } from '@adatechnology/module-http'

import type { CatalogModule } from '../CatalogModule'
import { requireCompany } from './requireCompany'

export function buildSyncRoutes(module: CatalogModule): ModuleRoute[] {
  const { useCases } = module

  return [
    {
      method: 'POST',
      path: '/products/:id/sync',
      scope: 'admin',
      operationId: 'syncProductToMeta',
      summary: 'Publica um produto na Meta Commerce agora',
      async handler(context) {
        const companyId = requireCompany(context)
        const outcome = await useCases.syncProductToMeta.execute({
          companyId,
          productId: context.params.id ?? '',
        })
        // 200 mesmo em `permanent`: a requisição foi processada, e o resultado da publicação é o
        // corpo. 4xx faria o cliente achar que o pedido dele estava malformado.
        return { kind: 'json', status: 200, body: { data: outcome } }
      },
    },

    {
      method: 'POST',
      path: '/catalogs/:id/sync',
      scope: 'admin',
      operationId: 'syncCatalogToMeta',
      summary: 'Publica um catálogo como product set na Meta',
      async handler(context) {
        const companyId = requireCompany(context)
        const outcome = await useCases.syncCatalogToMeta.execute({
          companyId,
          catalogId: context.params.id ?? '',
        })
        return { kind: 'json', status: 200, body: { data: outcome } }
      },
    },

    {
      method: 'POST',
      path: '/sync/pending',
      scope: 'admin',
      operationId: 'syncPendingToMeta',
      summary: 'Roda a varredura de pendentes sob demanda (o cron faz o mesmo)',
      async handler(context) {
        const companyId = requireCompany(context)
        const result = await useCases.syncPendingToMeta.execute({ companyId })
        return { kind: 'json', status: 200, body: { data: result } }
      },
    },

    {
      method: 'POST',
      path: '/sync/retry-failed',
      scope: 'admin',
      operationId: 'retryFailedSyncs',
      summary: 'Devolve os que falharam para a fila de pendentes',
      async handler(context) {
        const companyId = requireCompany(context)
        const result = await useCases.retryFailedSyncs.execute({ companyId })
        return { kind: 'json', status: 200, body: { data: result } }
      },
    },
  ]
}
