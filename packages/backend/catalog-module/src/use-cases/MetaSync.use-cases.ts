/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Publicação na Meta Commerce.
 *
 * **Sem fila, e é decisão, não omissão.** O `notification-module` usa fila porque entrega é por
 * evento, sensível a latência e de volume alto. Catálogo é o contrário: muda quando um operador
 * edita, tolera minutos de atraso e ganha com lote. Uma varredura por cron sobre
 * `syncStatus = 'pending'` cobre o caso — e ainda recupera sozinha o item que ficaria perdido se
 * um enfileiramento falhasse. Exigir broker para publicar produto seria custo sem retorno.
 */

import {
  CATALOG_EVENT,
  CatalogNotFoundError,
  MetaSyncDisabledError,
  PRODUCT_SYNC_STATUS,
  ProductNotFoundError,
} from '@adatechnology/catalog-contracts'
import type { MetaProductPayload, MetaSyncOutcome } from '@adatechnology/catalog-contracts'

import type { ProductRow } from '../schema/schema'
import { nowOf, runHook, type CatalogDependencies } from './catalogModule.types'

/** Teto por varredura: uma base grande não pode virar milhares de chamadas num tique de cron. */
const DEFAULT_SWEEP_LIMIT = 100

function toMetaPayload(row: ProductRow, currency: string): MetaProductPayload {
  return {
    // `retailerId` é o id daqui — é assim que o recibo da Meta volta a apontar para o produto.
    retailerId: row.id,
    name: row.name,
    // A Meta recusa descrição vazia; cair para o nome é melhor que falhar a publicação por um
    // campo que o operador deixou em branco.
    description: row.description ?? row.name,
    priceInCents: row.priceInCents,
    currency,
    imageUrl: row.imageUrl ?? undefined,
    availability: row.availability as MetaProductPayload['availability'],
  }
}

export class SyncProductToMetaUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(params: { companyId: string; productId: string }): Promise<MetaSyncOutcome> {
    const { metaSync, config } = this.dependencies
    if (!metaSync || !config.metaSync?.products) throw new MetaSyncDisabledError()

    const row = await this.dependencies.products.findById({ companyId: params.companyId, id: params.productId })
    if (!row) throw new ProductNotFoundError(params.productId)

    const outcome = await metaSync.upsertProduct(toMetaPayload(row, config.currency))
    await this.applyOutcome({ companyId: params.companyId, entity: 'product', id: row.id, outcome })
    return outcome
  }

  private async applyOutcome(params: {
    companyId: string
    entity: 'product'
    id: string
    outcome: MetaSyncOutcome
  }): Promise<void> {
    const occurredAt = nowOf(this.dependencies)
    // `const` local: dentro do closure do hook, o TS perde a narrowing de `params.outcome`,
    // porque `params` é parâmetro mutável capturado.
    const { outcome } = params

    if (outcome.outcome === 'synced') {
      await this.dependencies.products.markSync({
        companyId: params.companyId,
        id: params.id,
        syncStatus: PRODUCT_SYNC_STATUS.SYNCED,
        externalId: outcome.externalId,
        syncError: null,
      })
      await runHook({
        dependencies: this.dependencies,
        name: CATALOG_EVENT.SYNC_SUCCEEDED,
        run: () =>
          this.dependencies.hooks?.onSyncSucceeded?.({
            companyId: params.companyId,
            occurredAt,
            entity: 'product',
            entityId: params.id,
            externalId: outcome.externalId,
          }),
      })
      return
    }

    // `retriable` fica em `pending`: a próxima varredura tenta de novo sozinha, sem precisar de
    // reenfileiramento nem de backoff explícito — o intervalo do cron É o backoff.
    const retriable = outcome.outcome === 'retriable'
    const status = retriable ? PRODUCT_SYNC_STATUS.PENDING : PRODUCT_SYNC_STATUS.FAILED

    await this.dependencies.products.markSync({
      companyId: params.companyId,
      id: params.id,
      syncStatus: status,
      syncError: outcome.message,
    })

    await runHook({
      dependencies: this.dependencies,
      name: CATALOG_EVENT.SYNC_FAILED,
      run: () =>
        this.dependencies.hooks?.onSyncFailed?.({
          companyId: params.companyId,
          occurredAt,
          entity: 'product',
          entityId: params.id,
          errorCode: outcome.errorCode,
          status,
          willRetry: retriable,
        }),
    })
  }
}

export class SyncCatalogToMetaUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(params: { companyId: string; catalogId: string }): Promise<MetaSyncOutcome> {
    const { metaSync, config } = this.dependencies
    if (!metaSync || !config.metaSync?.catalogs) throw new MetaSyncDisabledError()

    const row = await this.dependencies.catalogs.findById({ companyId: params.companyId, id: params.catalogId })
    if (!row) throw new CatalogNotFoundError(params.catalogId)

    // Na Meta, o catálogo do host vira um *product set*; `externalId` presente = atualiza.
    const outcome = await metaSync.upsertProductSet({ name: row.name, externalId: row.externalId ?? undefined })

    if (outcome.outcome === 'synced') {
      await this.dependencies.catalogs.markSync({
        companyId: params.companyId,
        id: row.id,
        syncStatus: PRODUCT_SYNC_STATUS.SYNCED,
        externalId: outcome.externalId,
        syncError: null,
      })
    } else {
      await this.dependencies.catalogs.markSync({
        companyId: params.companyId,
        id: row.id,
        syncStatus: outcome.outcome === 'retriable' ? PRODUCT_SYNC_STATUS.PENDING : PRODUCT_SYNC_STATUS.FAILED,
        syncError: outcome.message,
      })
    }

    return outcome
  }
}

export type SweepResult = {
  readonly processed: number
  readonly synced: number
  readonly failed: number
}

export class SyncPendingToMetaUseCase {
  constructor(
    private readonly dependencies: CatalogDependencies,
    private readonly syncProduct: SyncProductToMetaUseCase,
  ) {}

  /**
   * Varredura do cron. **Recebe `companyId`** porque o módulo não conhece a lista de empresas do
   * host — quem agenda sabe quais existem, e varrer "todas" exigiria o módulo consultar uma
   * tabela que não é dele.
   */
  async execute(params: { companyId: string; limit?: number }): Promise<SweepResult> {
    if (!this.dependencies.config.metaSync?.products) return { processed: 0, synced: 0, failed: 0 }

    const pending = await this.dependencies.products.listBySyncStatus({
      companyId: params.companyId,
      syncStatus: PRODUCT_SYNC_STATUS.PENDING,
      limit: params.limit ?? DEFAULT_SWEEP_LIMIT,
    })

    let synced = 0
    let failed = 0

    for (const row of pending) {
      // rate limit por app, e disparar 100 chamadas simultâneas garantiria 429 em quase todas.
      const outcome = await this.syncProduct
        .execute({ companyId: params.companyId, productId: row.id })
        .catch((error: unknown) => {
          this.dependencies.logger?.warn('catalog.sync_sweep.item_failed', { productId: row.id, error: String(error) })
          return { outcome: 'permanent' as const, errorCode: 'sweep_error', message: String(error) }
        })

      if (outcome.outcome === 'synced') synced += 1
      else failed += 1
    }

    return { processed: pending.length, synced, failed }
  }
}

export class RetryFailedSyncsUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  /**
   * Devolve os `failed` para `pending`, e a varredura seguinte os tenta de novo. Existe porque
   * erro permanente costuma ser corrigível pelo operador (imagem fora do padrão, descrição
   * vazia): depois de editar, ele republica em lote em vez de item a item.
   */
  async execute(params: { companyId: string; limit?: number }): Promise<{ requeued: number }> {
    const failed = await this.dependencies.products.listBySyncStatus({
      companyId: params.companyId,
      syncStatus: PRODUCT_SYNC_STATUS.FAILED,
      limit: params.limit ?? DEFAULT_SWEEP_LIMIT,
    })

    await Promise.all(
      failed.map((row) =>
        this.dependencies.products.markSync({
          companyId: params.companyId,
          id: row.id,
          syncStatus: PRODUCT_SYNC_STATUS.PENDING,
          syncError: null,
        }),
      ),
    )

    return { requeued: failed.length }
  }
}
