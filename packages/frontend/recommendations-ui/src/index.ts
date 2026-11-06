/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export {
  RecommendationsProvider,
  useRecommendationsApi,
  useRecommendationLabels,
} from './providers/RecommendationsProvider'
export type { RecommendationsProviderProps } from './providers/RecommendationsProvider'

export { RecommendationFeed, RecommendationCard } from './RecommendationFeed'
export type { RecommendationFeedProps, RecommendationCardProps } from './RecommendationFeed'

export { useRecommendationFeed } from './useRecommendationFeed'
export type { UseRecommendationFeedResult } from './useRecommendationFeed'

export { RecommendationAdmin } from './RecommendationAdmin'
export type { RecommendationAdminProps } from './RecommendationAdmin'

export { createFetchRecommendationsApi, RecommendationsApiError } from './lib/fetchApi'
export type { CreateFetchRecommendationsApiParams } from './lib/fetchApi'

export { DEFAULT_LABELS } from './lib/labels'
export type { RecommendationLabels } from './lib/labels'

export {
  buildItemPayload,
  buildCampaignPayload,
  toUpdatePayload,
  emptyDraft,
  draftFromItem,
  parseTags,
  clickRate,
  last30Days,
} from './lib/itemDraft'
export type { ItemDraft, CampaignDraft, DraftError } from './lib/itemDraft'

export { FIELD_TYPE } from './providers/types'
export type * from './providers/types'
