/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type {
  Campaign,
  CampaignDiscount,
  CodeMode,
  Coupon,
  CouponStatus,
  DiscountKind,
  Lead,
  PublicCampaign,
  Redemption,
  RedemptionStatus,
} from '@adatechnology/coupon-contracts'

import type { CampaignRow, CouponRow, LeadRow, RedemptionRow } from '../schema/schema'

const iso = (value: Date | null): string | null => (value ? value.toISOString() : null)

export function toDiscount(row: CampaignRow): CampaignDiscount {
  return {
    kind: row.discountKind as DiscountKind,
    value: row.discountValue,
    maxDiscountCents: row.maxDiscountCents,
    minSubtotalCents: row.minSubtotalCents,
  }
}

export function toCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    title: row.title,
    text: row.text,
    terms: row.terms,
    isActive: row.isActive,
    startsAt: iso(row.startsAt),
    endsAt: iso(row.endsAt),
    discount: toDiscount(row),
    codeMode: row.codeMode as CodeMode,
    fixedCode: row.fixedCode,
    codePrefix: row.codePrefix,
    usageLimitTotal: row.usageLimitTotal,
    usageLimitPerCustomer: row.usageLimitPerCustomer,
    usageLimitPerCode: row.usageLimitPerCode,
    scope: row.scope,
    isAutomatic: row.isAutomatic,
    leadCapture: row.leadCapture,
    leadTag: row.leadTag,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Sem código, limite nem contagem: é o que vai para o site anônimo. */
export function toPublicCampaign(row: CampaignRow): PublicCampaign {
  return {
    id: row.id,
    title: row.title,
    text: row.text,
    terms: row.terms,
    startsAt: iso(row.startsAt),
    endsAt: iso(row.endsAt),
    discount: toDiscount(row),
    isAutomatic: row.isAutomatic,
    leadCapture: row.leadCapture,
  }
}

export function toCoupon(row: CouponRow): Coupon {
  return {
    id: row.id,
    companyId: row.companyId,
    campaignId: row.campaignId,
    code: row.code,
    leadId: row.leadId,
    usedCount: row.usedCount,
    status: row.status as CouponStatus,
    createdAt: row.createdAt.toISOString(),
  }
}

export function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    companyId: row.companyId,
    campaignId: row.campaignId,
    name: row.name,
    phone: row.phone,
    email: row.email,
    customerRef: row.customerRef,
    couponCode: row.couponCode,
    consentText: row.consentText,
    consentedAt: row.consentedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

export function toRedemption(row: RedemptionRow): Redemption {
  return {
    id: row.id,
    companyId: row.companyId,
    campaignId: row.campaignId,
    couponCode: row.couponCode,
    orderRef: { kind: row.orderKind, id: row.orderId },
    customerRef: row.customerRef,
    subtotalCents: row.subtotalCents,
    discountCents: row.discountCents,
    status: row.status as RedemptionStatus,
    redeemedAt: row.redeemedAt.toISOString(),
    releasedAt: iso(row.releasedAt),
  }
}

export function paginate<TItem>(params: {
  readonly data: readonly TItem[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
}) {
  return {
    data: params.data,
    pagination: {
      total: params.total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.max(1, Math.ceil(params.total / params.pageSize)),
    },
  }
}
