/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Os tipos do lado da tela. Espelham `@adatechnology/recommendation-contracts` sem depender dele:
 * o pacote de UI não puxa zod nem nada de servidor para o bundle do navegador. Datas chegam como
 * texto ISO, porque é assim que o JSON as entrega.
 */

export const FIELD_TYPE = {
  TEXT: 'text',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  SELECT: 'select',
  URL: 'url',
} as const

export type FieldType = (typeof FIELD_TYPE)[keyof typeof FIELD_TYPE]

export type FieldDefinition = {
  readonly name: string
  readonly label: string
  readonly type: FieldType
  readonly required: boolean
  readonly options?: readonly { readonly value: string; readonly label: string }[]
}

export type KindDefinition = {
  readonly name: string
  readonly label: string
  readonly fields: readonly FieldDefinition[]
}
export type PlanDefinition = { readonly name: string; readonly label: string; readonly weight: number }
export type PlacementDefinition = { readonly name: string; readonly label: string; readonly maxSponsored?: number }

export type RecommendationSettings = {
  readonly kinds: readonly KindDefinition[]
  readonly plans: readonly PlanDefinition[]
  readonly placements: readonly PlacementDefinition[]
}

export type RecommendationSource = 'sponsored' | 'curated'
export type ItemStatus = 'draft' | 'active' | 'paused' | 'archived'
export type CampaignStatus = 'active' | 'paused' | 'ended'
export type RecommendationEventType = 'impression' | 'click'

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
  readonly sponsorId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export type Campaign = {
  readonly id: string
  readonly itemId: string
  readonly plan: string
  readonly status: CampaignStatus
  readonly priority: number
  readonly startsAt: string
  readonly endsAt: string | null
  readonly placements: readonly string[]
  readonly externalReference: string | null
}

export type RecommendationItemWithCampaigns = RecommendationItem & { readonly campaigns: readonly Campaign[] }

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

export type Feed = { readonly placement: string; readonly entries: readonly FeedEntry[] }

export type FeedQuery = {
  readonly placement: string
  readonly kind?: string
  readonly city?: string
  readonly age?: number
  readonly tags?: readonly string[]
  readonly limit?: number
}

export type ListItemsQuery = {
  readonly page?: number
  readonly perPage?: number
  readonly kind?: string
  readonly source?: RecommendationSource
  readonly status?: ItemStatus
  readonly sponsorId?: string
  readonly search?: string
}

export type PaginatedItems = {
  readonly data: readonly RecommendationItem[]
  readonly pagination: { readonly total: number; readonly page: number; readonly perPage: number }
}

export type ItemInput = {
  readonly title: string
  readonly summary?: string | null
  readonly imageUrl?: string | null
  readonly linkUrl?: string | null
  readonly city?: string | null
  readonly state?: string | null
  readonly minAge?: number | null
  readonly maxAge?: number | null
  readonly tags?: readonly string[]
  readonly attributes?: Readonly<Record<string, unknown>>
  readonly sponsorId?: string | null
  readonly status?: ItemStatus
}

export type CreateItemInput = ItemInput & { readonly kind: string; readonly source: RecommendationSource }
export type UpdateItemInput = Partial<ItemInput>

export type CampaignInput = {
  readonly plan: string
  readonly priority?: number
  readonly startsAt: string
  readonly endsAt?: string | null
  readonly placements?: readonly string[]
  readonly externalReference?: string | null
  readonly status?: CampaignStatus
}

export type CampaignStatsRow = {
  readonly itemId: string
  readonly campaignId: string | null
  readonly placement: string
  readonly impressions: number
  readonly clicks: number
}

export type StatsQuery = {
  readonly from: string
  readonly to: string
  readonly itemId?: string
  readonly sponsorId?: string
}

/** O que a tela precisa do servidor. O host injeta; `createFetchRecommendationsApi` é a padrão. */
export type RecommendationsApi = {
  getFeed(query: FeedQuery): Promise<Feed>
  trackEvent(event: {
    readonly itemId: string
    readonly campaignId: string | null
    readonly placement: string
    readonly type: RecommendationEventType
  }): Promise<void>
  getSettings(): Promise<RecommendationSettings>
  listItems(query: ListItemsQuery): Promise<PaginatedItems>
  getItem(id: string): Promise<RecommendationItemWithCampaigns>
  createItem(input: CreateItemInput): Promise<RecommendationItem>
  updateItem(id: string, input: UpdateItemInput): Promise<RecommendationItem>
  createCampaign(itemId: string, input: CampaignInput): Promise<Campaign>
  updateCampaign(id: string, input: Partial<CampaignInput>): Promise<Campaign>
  getStats(query: StatsQuery): Promise<readonly CampaignStatsRow[]>
}

/** Anunciante para o seletor da administração, vindo de onde o host guarda (ex.: customer-module). */
export type SponsorOption = { readonly id: string; readonly label: string }
