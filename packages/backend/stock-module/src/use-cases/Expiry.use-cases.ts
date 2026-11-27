/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Varredura de validade para o job diário do host (cron, worker): lotes com saldo que vencem na
 * janela, agrupados por empresa, entregues ao gancho `onBatchesExpiring`.
 */

import type { ExpiringBatch } from '@adatechnology/stock-contracts'

import { runHook } from '../shared/runHook'
import { isStockEnabled, loadIngredients } from '../shared/stockContext'
import { toBatch } from '../shared/toContract'
import type { StockDependencies } from './stockModule.types'

const DAY_MS = 86_400_000
const DEFAULT_ALERT_DAYS = 7
const SCAN_LIMIT = 5_000

export type ScanExpiringBatchesResult = { readonly companies: number; readonly batches: number }

export class ScanExpiringBatchesUseCase {
  constructor(private readonly dependencies: StockDependencies) {}

  async execute(params: { readonly withinDays?: number } = {}): Promise<ScanExpiringBatchesResult> {
    const { dependencies } = this
    const days = params.withinDays ?? dependencies.config.expiryAlertDays ?? DEFAULT_ALERT_DAYS
    const expiresBefore = new Date(dependencies.clock.now().getTime() + days * DAY_MS)
    const rows = await dependencies.persistence.stock.findExpiringBatches({ expiresBefore, limit: SCAN_LIMIT })
    const byCompany = new Map<string, typeof rows>()
    for (const row of rows) byCompany.set(row.companyId, [...(byCompany.get(row.companyId) ?? []), row])

    let notified = 0
    // Por empresa em sequência: o gancho costuma mandar notificação, e o volume é o de um dia.
    for (const [companyId, companyRows] of byCompany) {
      if (!(await isStockEnabled(dependencies, companyId))) continue
      const ingredients = await loadIngredients({
        dependencies,
        companyId,
        ingredientIds: companyRows.map((row) => row.ingredientId),
      })
      const batches: ExpiringBatch[] = companyRows.map((row) => ({
        ...toBatch(row),
        companyId,
        ingredientName: ingredients.get(row.ingredientId)?.name ?? null,
      }))
      notified += batches.length
      await runHook({
        name: 'onBatchesExpiring',
        logger: dependencies.logger,
        meta: { companyId, batches: batches.length },
        run: () => dependencies.hooks?.onBatchesExpiring?.({ companyId, batches }),
      })
    }
    return { companies: byCompany.size, batches: notified }
  }
}
