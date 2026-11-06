/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, desc, eq, gt, isNull, lte, or, sql, type SQL } from 'drizzle-orm'

import {
  CAMPAIGN_STATUS,
  ITEM_STATUS,
  RECOMMENDATION_SOURCE,
  type ListItemsQuery,
} from '@adatechnology/recommendation-contracts'

import type { RecommendationDatabase } from '../database.types'
import { campaigns, items, type CampaignRow, type ItemRow, type NewItemRow } from '../schema/schema'

/** Teto de candidatos lidos por feed. O feed mostra no máximo 30; 100 dá folga ao rodízio. */
const CANDIDATE_LIMIT = 100

export type AudienceFilter = {
  readonly companyId: string | undefined
  readonly kind?: string
  readonly city?: string
  readonly age?: number
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

export class ItemRepository {
  constructor(private readonly db: RecommendationDatabase) {}

  /** `company_id IS NULL` em single-tenant; `=` em multi. Um lugar só decide isso. */
  scope(companyId: string | undefined): SQL {
    return companyId === undefined ? isNull(items.companyId) : eq(items.companyId, companyId)
  }

  async insert(values: NewItemRow): Promise<ItemRow> {
    const [row] = await this.db.insert(items).values(values).returning()
    if (!row) throw new Error('recommendation-module: insert de item não devolveu linha')
    return row
  }

  async update(params: {
    readonly companyId: string | undefined
    readonly id: string
    readonly values: Partial<NewItemRow>
  }): Promise<ItemRow | undefined> {
    const [row] = await this.db
      .update(items)
      .set({ ...params.values, updatedAt: new Date() })
      .where(and(eq(items.id, params.id), this.scope(params.companyId)))
      .returning()
    return row
  }

  async findById(params: {
    readonly companyId: string | undefined
    readonly id: string
  }): Promise<ItemRow | undefined> {
    const [row] = await this.db
      .select()
      .from(items)
      .where(and(eq(items.id, params.id), this.scope(params.companyId)))
      .limit(1)
    return row
  }

  async list(params: { readonly companyId: string | undefined; readonly query: ListItemsQuery }) {
    const { query } = params
    const conditions: SQL[] = [this.scope(params.companyId)]
    if (query.kind) conditions.push(eq(items.kind, query.kind))
    if (query.source) conditions.push(eq(items.source, query.source))
    // Arquivado só aparece quando pedido: é a lixeira, não a lista de trabalho.
    if (query.status) conditions.push(eq(items.status, query.status))
    else conditions.push(sql`${items.status} <> ${ITEM_STATUS.ARCHIVED}`)
    if (query.sponsorId) conditions.push(eq(items.sponsorId, query.sponsorId))
    if (query.search) conditions.push(sql`${items.title} ilike ${`%${escapeLike(query.search)}%`}`)

    const where = and(...conditions)
    const [rows, [counted]] = await Promise.all([
      this.db
        .select()
        .from(items)
        .where(where)
        .orderBy(desc(items.updatedAt))
        .limit(query.perPage)
        .offset((query.page - 1) * query.perPage),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(items)
        .where(where),
    ])

    return { rows, total: Number(counted?.total ?? 0) }
  }

  /**
   * Público-alvo, aplicado no banco.
   *
   * Cidade é estrita: quem não informou cidade só vê o que vale para qualquer lugar. Mostrar o
   * parque de outra cidade a quem não disse onde mora é anúncio desperdiçado e confuso.
   */
  private audience(filter: AudienceFilter): SQL[] {
    const conditions: SQL[] = [this.scope(filter.companyId), eq(items.status, ITEM_STATUS.ACTIVE)]
    if (filter.kind) conditions.push(eq(items.kind, filter.kind))

    if (filter.city) {
      conditions.push(or(isNull(items.city), sql`lower(trim(${items.city})) = lower(trim(${filter.city}))`) as SQL)
    } else {
      conditions.push(isNull(items.city))
    }

    if (filter.age !== undefined) {
      conditions.push(or(isNull(items.minAge), lte(items.minAge, filter.age)) as SQL)
      conditions.push(or(isNull(items.maxAge), sql`${items.maxAge} >= ${filter.age}`) as SQL)
    }

    return conditions
  }

  /** Itens patrocinados com campanha no ar AGORA neste espaço. Uma linha por campanha. */
  async sponsoredCandidates(
    params: AudienceFilter & { readonly placement: string; readonly now: Date },
  ): Promise<{ item: ItemRow; campaign: CampaignRow }[]> {
    const rows = await this.db
      .select({ item: items, campaign: campaigns })
      .from(items)
      .innerJoin(campaigns, eq(campaigns.itemId, items.id))
      .where(
        and(
          ...this.audience(params),
          eq(items.source, RECOMMENDATION_SOURCE.SPONSORED),
          eq(campaigns.status, CAMPAIGN_STATUS.ACTIVE),
          lte(campaigns.startsAt, params.now),
          or(isNull(campaigns.endsAt), gt(campaigns.endsAt, params.now)),
          sql`(cardinality(${campaigns.placements}) = 0 or ${params.placement} = any(${campaigns.placements}))`,
        ),
      )
      .limit(CANDIDATE_LIMIT)
    return rows
  }

  async curatedCandidates(params: AudienceFilter): Promise<ItemRow[]> {
    return this.db
      .select()
      .from(items)
      .where(and(...this.audience(params), eq(items.source, RECOMMENDATION_SOURCE.CURATED)))
      .orderBy(desc(items.updatedAt))
      .limit(CANDIDATE_LIMIT)
  }
}
