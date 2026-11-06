/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Composição raiz. O host injeta banco, configuração e, se quiser, as portas de anunciante e de
 * assinatura; o módulo não escolhe nenhum deles.
 */

import {
  ConfigInvalidError,
  recommendationModuleConfigSchema,
  type CampaignEntitlementPort,
  type ClockPort,
  type LoggerPort,
  type RandomPort,
  type RecommendationModuleConfig,
  type RecommendationSettings,
  type SponsorDirectoryPort,
} from '@adatechnology/recommendation-contracts'

import type { RecommendationDatabase } from './database.types'
import { CampaignRepository } from './repositories/CampaignRepository'
import { ItemRepository } from './repositories/ItemRepository'
import { StatsRepository } from './repositories/StatsRepository'
import { CreateCampaignUseCase, UpdateCampaignUseCase } from './use-cases/Campaign.use-case'
import type { UseCaseContext } from './use-cases/context'
import { GetFeedUseCase, GetStatsUseCase, TrackEventUseCase } from './use-cases/Feed.use-case'
import { CreateItemUseCase, GetItemUseCase, ListItemsUseCase, UpdateItemUseCase } from './use-cases/Item.use-case'

export type CreateRecommendationModuleParams = {
  readonly db: RecommendationDatabase
  readonly config: RecommendationModuleConfig
  /** Confere se o anunciante existe (ex.: busca no `customer-module`). */
  readonly sponsors?: SponsorDirectoryPort
  /** O gancho da assinatura: sem ela, toda campanha ativa no período vai ao ar. */
  readonly entitlement?: CampaignEntitlementPort
  readonly clock?: ClockPort
  readonly random?: RandomPort
  readonly logger?: LoggerPort
}

export type RecommendationModule = ReturnType<typeof createRecommendationModule>

export function createRecommendationModule(params: CreateRecommendationModuleParams) {
  // Configuração inválida derruba o BOOT, não a primeira requisição de um usuário.
  const parsed = recommendationModuleConfigSchema.safeParse(params.config)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new ConfigInvalidError(`Configuração do recommendation-module inválida — ${issues}`)
  }

  const config = params.config
  const context: UseCaseContext = {
    config,
    items: new ItemRepository(params.db),
    campaigns: new CampaignRepository(params.db),
    stats: new StatsRepository(params.db),
    clock: params.clock ?? { now: () => new Date() },
    random: params.random ?? { next: () => Math.random() },
    ...(params.sponsors ? { sponsors: params.sponsors } : {}),
    ...(params.entitlement ? { entitlement: params.entitlement } : {}),
    ...(params.logger ? { logger: params.logger } : {}),
  }

  const settings: RecommendationSettings = {
    kinds: config.kinds,
    plans: config.plans,
    placements: config.placements,
  }

  return {
    config,
    settings,
    repositories: { items: context.items, campaigns: context.campaigns, stats: context.stats },
    useCases: {
      createItem: new CreateItemUseCase(context),
      updateItem: new UpdateItemUseCase(context),
      getItem: new GetItemUseCase(context),
      listItems: new ListItemsUseCase(context),
      createCampaign: new CreateCampaignUseCase(context),
      updateCampaign: new UpdateCampaignUseCase(context),
      getFeed: new GetFeedUseCase(context),
      trackEvent: new TrackEventUseCase(context),
      getStats: new GetStatsUseCase(context),
    },
  } as const
}
