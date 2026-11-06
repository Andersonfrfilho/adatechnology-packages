/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O vocabulário do trio: item, campanha, entrada de feed e estatística.
 */

export const RECOMMENDATION_SOURCE = {
  /** Pago por um anunciante, sempre exibido com rótulo de patrocinado. */
  SPONSORED: 'sponsored',
  /** Escolhido pela equipe do produto, sem pagamento. */
  CURATED: 'curated',
} as const

export type RecommendationSource = (typeof RECOMMENDATION_SOURCE)[keyof typeof RECOMMENDATION_SOURCE]

export const ITEM_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
} as const

export type ItemStatus = (typeof ITEM_STATUS)[keyof typeof ITEM_STATUS]

export const CAMPAIGN_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  ENDED: 'ended',
} as const

export type CampaignStatus = (typeof CAMPAIGN_STATUS)[keyof typeof CAMPAIGN_STATUS]

export const RECOMMENDATION_EVENT = {
  IMPRESSION: 'impression',
  CLICK: 'click',
} as const

export type RecommendationEventType = (typeof RECOMMENDATION_EVENT)[keyof typeof RECOMMENDATION_EVENT]

export type RecommendationItem = {
  readonly id: string
  readonly kind: string
  readonly source: RecommendationSource
  readonly status: ItemStatus
  readonly title: string
  readonly summary: string | null
  readonly imageUrl: string | null
  readonly linkUrl: string | null
  readonly city: string | null
  readonly state: string | null
  readonly minAge: number | null
  readonly maxAge: number | null
  readonly tags: readonly string[]
  readonly attributes: Readonly<Record<string, unknown>>
  /**
   * Anunciante no `customer-module`, quando `source` é `sponsored`. Sem FK: outro schema, outro
   * journal — a existência é conferida pela `SponsorDirectoryPort`, quando o host a fornece.
   */
  readonly sponsorId: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type Campaign = {
  readonly id: string
  readonly itemId: string
  readonly plan: string
  readonly status: CampaignStatus
  /** Desempate dentro do mesmo plano. Maior aparece antes. */
  readonly priority: number
  readonly startsAt: Date
  /** `null` = sem data de fim. */
  readonly endsAt: Date | null
  /** Espaços onde a campanha roda. Vazio = todos. */
  readonly placements: readonly string[]
  /** Referência da assinatura/cobrança que paga a campanha, quando houver. */
  readonly externalReference: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type RecommendationItemWithCampaigns = RecommendationItem & {
  readonly campaigns: readonly Campaign[]
}

/** O que a tela do usuário final recebe. Sem dado do anunciante além do que está no card. */
export type FeedEntry = {
  readonly itemId: string
  readonly campaignId: string | null
  readonly kind: string
  readonly sponsored: boolean
  readonly plan: string | null
  readonly title: string
  readonly summary: string | null
  readonly imageUrl: string | null
  readonly linkUrl: string | null
  readonly city: string | null
  readonly state: string | null
  readonly tags: readonly string[]
  readonly attributes: Readonly<Record<string, unknown>>
}

export type Feed = {
  readonly placement: string
  readonly entries: readonly FeedEntry[]
}

export type CampaignStatsRow = {
  readonly itemId: string
  readonly campaignId: string | null
  readonly placement: string
  readonly impressions: number
  readonly clicks: number
}

export type PaginatedItems = {
  readonly data: readonly RecommendationItem[]
  readonly pagination: { readonly total: number; readonly page: number; readonly perPage: number }
}
