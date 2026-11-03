/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O que todo caso de uso recebe. Montado uma vez na fábrica do módulo.
 */

import {
  UnknownKindError,
  UnknownPlacementError,
  UnknownPlanError,
  type CampaignEntitlementPort,
  type ClockPort,
  type KindDefinition,
  type LoggerPort,
  type PlacementDefinition,
  type PlanDefinition,
  type RandomPort,
  type RecommendationModuleConfig,
  type SponsorDirectoryPort,
} from '@adatechnology/recommendation-contracts'

import type { CampaignRepository } from '../repositories/CampaignRepository'
import type { ItemRepository } from '../repositories/ItemRepository'
import type { StatsRepository } from '../repositories/StatsRepository'

export type UseCaseContext = {
  readonly config: RecommendationModuleConfig
  readonly items: ItemRepository
  readonly campaigns: CampaignRepository
  readonly stats: StatsRepository
  readonly clock: ClockPort
  readonly random: RandomPort
  readonly sponsors?: SponsorDirectoryPort
  readonly entitlement?: CampaignEntitlementPort
  readonly logger?: LoggerPort
}

/** Escopo opcional repassado às portas: `{}` em single-tenant, `{ companyId }` em multi. */
export function scopeArg(companyId: string | undefined): { companyId?: string } {
  return companyId === undefined ? {} : { companyId }
}

export function kindOf(config: RecommendationModuleConfig, name: string): KindDefinition {
  const kind = config.kinds.find((entry) => entry.name === name)
  if (!kind) throw new UnknownKindError(name)
  return kind
}

export function planOf(config: RecommendationModuleConfig, name: string): PlanDefinition {
  const plan = config.plans.find((entry) => entry.name === name)
  if (!plan) throw new UnknownPlanError(name)
  return plan
}

export function placementOf(config: RecommendationModuleConfig, name: string): PlacementDefinition {
  const placement = config.placements.find((entry) => entry.name === name)
  if (!placement) throw new UnknownPlacementError(name)
  return placement
}

export function assertPlacements(config: RecommendationModuleConfig, names: readonly string[]): void {
  for (const name of names) placementOf(config, name)
}

/** O dia do evento no fuso do produto, como `AAAA-MM-DD`. */
export function dayIn(date: Date, timeZone: string): string {
  // `en-CA` formata como AAAA-MM-DD; é o jeito portátil de pegar a data num fuso sem biblioteca.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
