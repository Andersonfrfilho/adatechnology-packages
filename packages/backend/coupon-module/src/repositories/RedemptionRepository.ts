/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { REDEMPTION_STATUS, type ListRedemptionsQuery } from '@adatechnology/coupon-contracts'
import { and, asc, count, desc, eq, sql } from 'drizzle-orm'

import type { CouponDatabase } from '../database.types'
import { redemptions, type NewRedemptionRow, type RedemptionRow } from '../schema/schema'
import type { Page, RedemptionStorePort, RedemptionTotals } from '../use-cases/couponModule.types'
import {
  redemptionActiveCondition,
  redemptionListCondition,
  redemptionOrderCondition,
  redemptionOwnedCondition,
} from './conditions'

const SORT_COLUMNS = {
  redeemedAt: redemptions.redeemedAt,
  discountCents: redemptions.discountCents,
  subtotalCents: redemptions.subtotalCents,
} as const

const countWhere = (condition: ReturnType<typeof sql>) =>
  sql<number>`count(*) filter (where ${condition})`.mapWith(Number)

export class RedemptionRepository implements RedemptionStorePort {
  constructor(private readonly db: CouponDatabase) {}

  async findByOrder(params: {
    companyId: string
    orderKind: string
    orderId: string
  }): Promise<RedemptionRow | undefined> {
    const [row] = await this.db.select().from(redemptions).where(redemptionOrderCondition(params)).limit(1)
    return row
  }

  /** Uma consulta só: total, por código e por cliente, contando apenas resgates ativos. */
  async usage(params: {
    companyId: string
    campaignId: string
    code: string | null
    customerRef: string | null
  }): Promise<{ totalUsed: number; codeUsed: number; customerUsed: number }> {
    const byCode = params.code === null ? sql`false` : sql`${redemptions.couponCode} = ${params.code}`
    const byCustomer =
      params.customerRef === null ? sql`false` : sql`${redemptions.customerRef} = ${params.customerRef}`
    const [row] = await this.db
      .select({ totalUsed: count(), codeUsed: countWhere(byCode), customerUsed: countWhere(byCustomer) })
      .from(redemptions)
      .where(redemptionActiveCondition(params))
    return { totalUsed: row?.totalUsed ?? 0, codeUsed: row?.codeUsed ?? 0, customerUsed: row?.customerUsed ?? 0 }
  }

  async insert(values: NewRedemptionRow): Promise<RedemptionRow> {
    const [row] = await this.db.insert(redemptions).values(values).returning()
    if (!row) throw new Error('coupons: INSERT de resgate sem retorno')
    return row
  }

  async update(params: {
    companyId: string
    id: string
    values: Partial<NewRedemptionRow>
  }): Promise<RedemptionRow | undefined> {
    const [row] = await this.db
      .update(redemptions)
      .set(params.values)
      .where(redemptionOwnedCondition(params))
      .returning()
    return row
  }

  async list(params: ListRedemptionsQuery & { companyId: string; campaignId: string }): Promise<Page<RedemptionRow>> {
    const where = redemptionListCondition({ ...params, statuses: params.status })
    const column = SORT_COLUMNS[params.sort]
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(redemptions)
        .where(where)
        .orderBy(params.order === 'asc' ? asc(column) : desc(column), asc(redemptions.id))
        .limit(params.pageSize)
        .offset((params.page - 1) * params.pageSize),
      this.db.select({ total: count() }).from(redemptions).where(where),
    ])
    return { rows, total: totals[0]?.total ?? 0 }
  }

  async totals(params: { companyId: string; campaignId: string }): Promise<RedemptionTotals> {
    const active = sql`${redemptions.status} = ${REDEMPTION_STATUS.REDEEMED}`
    const [row] = await this.db
      .select({
        redeemed: countWhere(active),
        released: countWhere(sql`${redemptions.status} = ${REDEMPTION_STATUS.RELEASED}`),
        discountCents: sql<number>`coalesce(sum(${redemptions.discountCents}) filter (where ${active}), 0)`.mapWith(
          Number,
        ),
        subtotalCents: sql<number>`coalesce(sum(${redemptions.subtotalCents}) filter (where ${active}), 0)`.mapWith(
          Number,
        ),
      })
      .from(redemptions)
      .where(and(eq(redemptions.companyId, params.companyId), eq(redemptions.campaignId, params.campaignId)))
    return {
      redeemed: row?.redeemed ?? 0,
      released: row?.released ?? 0,
      discountCents: row?.discountCents ?? 0,
      subtotalCents: row?.subtotalCents ?? 0,
    }
  }
}
