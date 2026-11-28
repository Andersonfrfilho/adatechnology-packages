/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Toda condição alcançável por uma requisição vive aqui como função pura exportada — a mesma que o
 * repositório chama e que `isolation.test.ts` renderiza em SQL. Um refactor que esqueça o filtro
 * de empresa quebra o teste na hora.
 */

import {
  CAMPAIGN_STATE,
  REDEMPTION_STATUS,
  type CampaignState,
  type RedemptionStatus,
} from '@adatechnology/coupon-contracts'
import { and, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, or, sql, type SQL } from 'drizzle-orm'

import { campaigns, coupons, leads, redemptions } from '../schema/schema'

/** `%texto%` com `%`, `_` e `\` escapados: a busca do operador nunca vira curinga. */
export function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`
}

export function campaignOwnedCondition(params: { companyId: string; id: string }): SQL {
  return and(eq(campaigns.companyId, params.companyId), eq(campaigns.id, params.id)) as SQL
}

/** Mesma regra de `campaignState` do contracts, em SQL. */
export function campaignStateCondition(state: CampaignState, now: Date): SQL {
  // Comparadores de coluna, não `sql` cru: o Drizzle converte o `Date` pelo tipo da coluna. Com o
  // `Date` cru no template, o postgres.js recusa o parâmetro (ERR_INVALID_ARG_TYPE).
  const ended = and(isNotNull(campaigns.endsAt), lte(campaigns.endsAt, now)) as SQL
  const notEnded = or(isNull(campaigns.endsAt), gt(campaigns.endsAt, now)) as SQL
  if (state === CAMPAIGN_STATE.ENDED) return ended
  if (state === CAMPAIGN_STATE.INACTIVE) return and(notEnded, eq(campaigns.isActive, false)) as SQL
  if (state === CAMPAIGN_STATE.SCHEDULED)
    return and(notEnded, eq(campaigns.isActive, true), gt(campaigns.startsAt, now)) as SQL
  return and(
    notEnded,
    eq(campaigns.isActive, true),
    or(isNull(campaigns.startsAt), lte(campaigns.startsAt, now)),
  ) as SQL
}

export function campaignListCondition(params: {
  companyId: string
  search?: string | undefined
  states?: readonly CampaignState[] | undefined
  now: Date
}): SQL {
  const conditions: SQL[] = [eq(campaigns.companyId, params.companyId)]
  if (params.search) {
    const pattern = likePattern(params.search)
    conditions.push(
      sql`(${campaigns.name} ilike ${pattern} or ${campaigns.title} ilike ${pattern} or ${campaigns.fixedCode} ilike ${pattern})`,
    )
  }
  if (params.states?.length)
    conditions.push(or(...params.states.map((state) => campaignStateCondition(state, params.now))) as SQL)
  return and(...conditions) as SQL
}

export function campaignOpenCondition(params: { companyId: string; now: Date; automaticOnly: boolean }): SQL {
  const conditions: SQL[] = [
    eq(campaigns.companyId, params.companyId),
    campaignStateCondition(CAMPAIGN_STATE.RUNNING, params.now),
  ]
  if (params.automaticOnly) conditions.push(eq(campaigns.isAutomatic, true))
  return and(...conditions) as SQL
}

export function couponCodeCondition(params: { companyId: string; code: string }): SQL {
  return and(eq(coupons.companyId, params.companyId), eq(coupons.code, params.code)) as SQL
}

export function couponOwnedCondition(params: { companyId: string; id: string }): SQL {
  return and(eq(coupons.companyId, params.companyId), eq(coupons.id, params.id)) as SQL
}

export function couponListCondition(params: {
  companyId: string
  campaignId: string
  search?: string | undefined
  unassigned?: boolean | undefined
}): SQL {
  const conditions: SQL[] = [eq(coupons.companyId, params.companyId), eq(coupons.campaignId, params.campaignId)]
  if (params.search) conditions.push(sql`${coupons.code} ilike ${likePattern(params.search)}`)
  if (params.unassigned) conditions.push(isNull(coupons.leadId))
  return and(...conditions) as SQL
}

export function leadOwnedCondition(params: { companyId: string; id: string }): SQL {
  return and(eq(leads.companyId, params.companyId), eq(leads.id, params.id)) as SQL
}

export function leadContactCondition(params: {
  companyId: string
  campaignId: string
  phone: string | null
  email: string | null
}): SQL {
  const contact: SQL[] = []
  if (params.phone) contact.push(eq(leads.phone, params.phone))
  if (params.email) contact.push(eq(leads.email, params.email))
  // Sem contato nenhum, nada casa (e nunca "todos os leads").
  const match = contact.length > 0 ? (or(...contact) as SQL) : sql`false`
  return and(eq(leads.companyId, params.companyId), eq(leads.campaignId, params.campaignId), match) as SQL
}

/** Busca por nome ou e-mail; telefone compara só os dígitos do que foi digitado. */
export function leadListCondition(params: {
  companyId: string
  campaignId: string
  search?: string | undefined
  /** Meio aberto: `from <= capturado < to`. */
  from?: string | undefined
  to?: string | undefined
}): SQL {
  const conditions: SQL[] = [eq(leads.companyId, params.companyId), eq(leads.campaignId, params.campaignId)]
  if (params.search) {
    const pattern = likePattern(params.search)
    const digits = params.search.replace(/\D/g, '')
    const byPhone = digits ? sql` or ${leads.phone} like ${likePattern(digits)}` : sql``
    conditions.push(sql`(${leads.name} ilike ${pattern} or ${leads.email} ilike ${pattern}${byPhone})`)
  }
  if (params.from) conditions.push(gte(leads.createdAt, new Date(params.from)))
  if (params.to) conditions.push(lt(leads.createdAt, new Date(params.to)))
  return and(...conditions) as SQL
}

export function redemptionOrderCondition(params: { companyId: string; orderKind: string; orderId: string }): SQL {
  return and(
    eq(redemptions.companyId, params.companyId),
    eq(redemptions.orderKind, params.orderKind),
    eq(redemptions.orderId, params.orderId),
  ) as SQL
}

export function redemptionOwnedCondition(params: { companyId: string; id: string }): SQL {
  return and(eq(redemptions.companyId, params.companyId), eq(redemptions.id, params.id)) as SQL
}

export function redemptionActiveCondition(params: { companyId: string; campaignId: string }): SQL {
  return and(
    eq(redemptions.companyId, params.companyId),
    eq(redemptions.campaignId, params.campaignId),
    eq(redemptions.status, REDEMPTION_STATUS.REDEEMED),
  ) as SQL
}

export function redemptionListCondition(params: {
  companyId: string
  campaignId: string
  search?: string | undefined
  statuses?: readonly RedemptionStatus[] | undefined
}): SQL {
  const conditions: SQL[] = [eq(redemptions.companyId, params.companyId), eq(redemptions.campaignId, params.campaignId)]
  if (params.statuses?.length) conditions.push(inArray(redemptions.status, [...params.statuses]))
  if (params.search) {
    const pattern = likePattern(params.search)
    conditions.push(sql`(${redemptions.couponCode} ilike ${pattern} or ${redemptions.orderId} ilike ${pattern})`)
  }
  return and(...conditions) as SQL
}

/** Campanha de outra empresa nunca entra, nem como "tem atividade". */
export function campaignActivityConditions(params: { companyId: string; id: string }): {
  leads: SQL
  redemptions: SQL
} {
  return {
    leads: and(eq(leads.companyId, params.companyId), eq(leads.campaignId, params.id)) as SQL,
    redemptions: and(eq(redemptions.companyId, params.companyId), eq(redemptions.campaignId, params.id)) as SQL,
  }
}
