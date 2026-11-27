/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { COUPON_STATUS, type CouponStatus, type ListCouponsQuery } from '@adatechnology/coupon-contracts'
import { and, asc, count, desc, eq, gt, isNull, sql } from 'drizzle-orm'

import type { CouponDatabase } from '../database.types'
import { coupons, type CouponRow, type NewCouponRow } from '../schema/schema'
import type { CouponCodeStorePort, Page } from '../use-cases/couponModule.types'
import { couponCodeCondition, couponListCondition, couponOwnedCondition } from './conditions'

// 3 parâmetros por linha: 5.000 linhas ficam longe do teto de 65.535 parâmetros do Postgres.
const INSERT_CHUNK = 5000

export class CouponCodeRepository implements CouponCodeStorePort {
  constructor(private readonly db: CouponDatabase) {}

  async insertMany(values: readonly NewCouponRow[]): Promise<CouponRow[]> {
    const inserted: CouponRow[] = []
    for (let start = 0; start < values.length; start += INSERT_CHUNK) {
      const chunk = values.slice(start, start + INSERT_CHUNK)
      inserted.push(...(await this.db.insert(coupons).values(chunk).onConflictDoNothing().returning()))
    }
    return inserted
  }

  async findByCode(params: { companyId: string; code: string }): Promise<CouponRow | undefined> {
    const [row] = await this.db.select().from(coupons).where(couponCodeCondition(params)).limit(1)
    return row
  }

  /** No modo `fixed` a campanha tem um único código, sem lead. */
  async findFixed(params: { companyId: string; campaignId: string }): Promise<CouponRow | undefined> {
    const [row] = await this.db
      .select()
      .from(coupons)
      .where(
        and(eq(coupons.companyId, params.companyId), eq(coupons.campaignId, params.campaignId), isNull(coupons.leadId)),
      )
      .orderBy(asc(coupons.createdAt))
      .limit(1)
    return row
  }

  async updateCode(params: { companyId: string; id: string; code: string }): Promise<CouponRow | undefined> {
    const [row] = await this.db
      .update(coupons)
      .set({ code: params.code })
      .where(couponOwnedCondition(params))
      .returning()
    return row
  }

  async setStatus(params: { companyId: string; id: string; status: CouponStatus }): Promise<CouponRow | undefined> {
    const [row] = await this.db
      .update(coupons)
      .set({ status: params.status })
      .where(couponOwnedCondition(params))
      .returning()
    return row
  }

  /** Um só UPDATE com a seleção travada: duas captações simultâneas nunca levam o mesmo código. */
  async claimUnassigned(params: {
    companyId: string
    campaignId: string
    leadId: string
  }): Promise<CouponRow | undefined> {
    const next = this.db
      .select({ id: coupons.id })
      .from(coupons)
      .where(
        and(
          eq(coupons.companyId, params.companyId),
          eq(coupons.campaignId, params.campaignId),
          isNull(coupons.leadId),
          eq(coupons.status, COUPON_STATUS.ACTIVE),
        ),
      )
      .orderBy(asc(coupons.createdAt), asc(coupons.id))
      .limit(1)
      .for('update', { skipLocked: true })
    const [row] = await this.db
      .update(coupons)
      .set({ leadId: params.leadId })
      .where(sql`${coupons.id} = (${next})`)
      .returning()
    return row
  }

  async adjustUsedCount(params: { companyId: string; code: string; delta: number }): Promise<void> {
    await this.db
      .update(coupons)
      .set({ usedCount: sql`greatest(0, ${coupons.usedCount} + ${params.delta})` })
      .where(couponCodeCondition(params))
  }

  async list(params: ListCouponsQuery & { companyId: string; campaignId: string }): Promise<Page<CouponRow>> {
    const where = couponListCondition(params)
    const order = params.order === 'asc' ? asc(coupons.createdAt) : desc(coupons.createdAt)
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(coupons)
        .where(where)
        .orderBy(order, asc(coupons.id))
        .limit(params.pageSize)
        .offset((params.page - 1) * params.pageSize),
      this.db.select({ total: count() }).from(coupons).where(where),
    ])
    return { rows, total: totals[0]?.total ?? 0 }
  }

  async count(params: { companyId: string; campaignId: string }): Promise<{ total: number; used: number }> {
    const scope = and(eq(coupons.companyId, params.companyId), eq(coupons.campaignId, params.campaignId))
    const [row] = await this.db
      .select({
        total: count(),
        used: sql<number>`count(*) filter (where ${gt(coupons.usedCount, 0)})`.mapWith(Number),
      })
      .from(coupons)
      .where(scope)
    return { total: row?.total ?? 0, used: row?.used ?? 0 }
  }
}
