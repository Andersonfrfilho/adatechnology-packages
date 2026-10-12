/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  INFRA_COSTS_CACHE_KEY,
  INFRA_COSTS_CACHE_TTL_SECONDS,
  INFRA_COSTS_FALLBACK_CACHE_TTL_SECONDS,
  INFRA_COSTS_LAST_GOOD_CACHE_KEY,
  INFRA_COSTS_LAST_GOOD_TTL_SECONDS,
  INFRA_COSTS_RETRY_DELAY_MILLISECONDS,
  INFRA_COSTS_WINDOW_SOURCE,
} from '@adatechnology/railway-infra-contracts'
import { InfraNotConfiguredError, RailwayRateLimitedError } from '@adatechnology/railway-infra-contracts'
import { infraCostsResultSchema } from './infraCosts.schema'
import { parseCachedJson } from './parseCachedJson'
import { buildCostsResult } from './buildCostsResult'
import { resolveCostsWindow } from './resolveCostsWindow'
import type { InfraCacheInterface } from '@adatechnology/railway-infra-contracts'
import type { CostsResult, ResolveCostsWindowResult } from '@adatechnology/railway-infra-contracts'
import type { InfraSleep } from '@adatechnology/railway-infra-contracts'
import type { RailwayUsageRow } from '@adatechnology/railway-infra-contracts'
import type { RailwayGatewayInterface } from '@adatechnology/railway-infra-contracts'
import type { ResolveGateway } from '@adatechnology/railway-infra-contracts'

type Dependencies = {
  readonly resolveGateway: ResolveGateway
  /** Ausente = sempre atual. Falso quando o token trocou durante a chamada: o resultado não vai para o cache. */
  readonly isGatewayCurrent?: (gateway: RailwayGatewayInterface) => boolean
  readonly cache: InfraCacheInterface
  readonly sleep: InfraSleep
  readonly now: () => Date
}

/**
 * Custo acumulado do ciclo de cobranca. `endDate` do usage e sempre o FIM do ciclo: o Railway falha com "agora".
 * Projecao linear (acumulado x duracao do ciclo / tempo decorrido); o `estimatedUsage` so cobre CPU e memoria.
 */
export class GetInfraCostsUseCase {
  constructor(private readonly dependencies: Dependencies) {}

  async execute(): Promise<CostsResult> {
    // Antes de qualquer leitura de cache: remover o token precisa devolver 503 na hora.
    const railwayGateway = await this.dependencies.resolveGateway()
    if (!railwayGateway) throw new InfraNotConfiguredError()

    const cached = await this.readCostsCache(INFRA_COSTS_CACHE_KEY)
    if (cached) return cached

    const window = await resolveCostsWindow({ railwayGateway, now: this.dependencies.now })
    const rows = await this.fetchUsageOrStale({ railwayGateway, window })
    if ('isStale' in rows) return rows

    const inventory = await railwayGateway.listInventory()
    const result = buildCostsResult({ window, rows, inventory, now: this.dependencies.now() })
    if (this.dependencies.isGatewayCurrent?.(railwayGateway) ?? true) await this.storeResult(result)
    return result
  }

  private async readCostsCache(key: string): Promise<CostsResult | undefined> {
    const raw = await this.dependencies.cache.get(key)
    if (raw === null) return undefined
    return parseCachedJson({ raw, schema: infraCostsResultSchema }) as CostsResult | undefined
  }

  // Janela de mes-calendario nasce de falha transitoria do billing: nao vira "ultima copia boa" e expira logo.
  private async storeResult(result: CostsResult): Promise<void> {
    const { cache } = this.dependencies
    const serialized = JSON.stringify(result)
    if (result.windowSource === INFRA_COSTS_WINDOW_SOURCE.CALENDAR_MONTH) {
      await cache.set(INFRA_COSTS_CACHE_KEY, serialized, INFRA_COSTS_FALLBACK_CACHE_TTL_SECONDS)
      return
    }
    await cache.set(INFRA_COSTS_CACHE_KEY, serialized, INFRA_COSTS_CACHE_TTL_SECONDS)
    await cache.set(INFRA_COSTS_LAST_GOOD_CACHE_KEY, serialized, INFRA_COSTS_LAST_GOOD_TTL_SECONDS)
  }

  // O usage falha de forma intermitente: uma nova tentativa; depois, a ultima copia boa marcada como antiga.
  private async fetchUsageOrStale(params: {
    readonly railwayGateway: RailwayGatewayInterface
    readonly window: ResolveCostsWindowResult
  }): Promise<readonly RailwayUsageRow[] | CostsResult> {
    const { railwayGateway, window } = params
    const usageParams = { startDate: window.start, endDate: window.end }
    try {
      return await railwayGateway.getUsage(usageParams)
    } catch (error) {
      // Repetir contra um 429 so prolonga o bloqueio, mas a ultima copia boa ainda serve a tela.
      if (error instanceof RailwayRateLimitedError) return this.staleOrThrow(error)
      await this.dependencies.sleep(INFRA_COSTS_RETRY_DELAY_MILLISECONDS)
    }

    try {
      return await railwayGateway.getUsage(usageParams)
    } catch (error) {
      return this.staleOrThrow(error)
    }
  }

  private async staleOrThrow(error: unknown): Promise<CostsResult> {
    const lastGood = await this.readCostsCache(INFRA_COSTS_LAST_GOOD_CACHE_KEY)
    if (lastGood === undefined) throw error
    return { ...lastGood, isStale: true }
  }
}
