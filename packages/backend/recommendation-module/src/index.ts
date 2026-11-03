/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export * from './schema'
export {
  runRecommendationMigrations,
  recommendationMigrationsFolder,
  RECOMMENDATION_MIGRATIONS_TABLE,
} from './runMigrations'
export type { RunRecommendationMigrationsParams } from './runMigrations'
export type { RecommendationDatabase } from './database.types'
export { createRecommendationModule } from './RecommendationModule'
export type { RecommendationModule, CreateRecommendationModuleParams } from './RecommendationModule'
export { createRecommendationRoutes, RECOMMENDATION_SCOPE } from './http/routes'
export type { CreateRecommendationRoutesParams } from './http/routes'
export { rankFeed } from './domain/rankFeed'
export type { RankFeedParams, SponsoredCandidate, CuratedCandidate } from './domain/rankFeed'
export { validateAttributes } from './shared/attributes'
export { resolveScopeCompanyId } from './shared/tenancy'
export { toItem, toCampaign, toFeedEntry } from './shared/mappers'
export { ItemRepository } from './repositories/ItemRepository'
export { CampaignRepository } from './repositories/CampaignRepository'
export { StatsRepository } from './repositories/StatsRepository'
export { CreateItemUseCase, UpdateItemUseCase, GetItemUseCase, ListItemsUseCase } from './use-cases/Item.use-case'
export { CreateCampaignUseCase, UpdateCampaignUseCase } from './use-cases/Campaign.use-case'
export { GetFeedUseCase, TrackEventUseCase, GetStatsUseCase } from './use-cases/Feed.use-case'
