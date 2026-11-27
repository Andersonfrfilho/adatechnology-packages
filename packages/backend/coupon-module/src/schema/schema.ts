/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { CampaignScope, LeadCaptureSettings } from '@adatechnology/coupon-contracts'
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// Schema Postgres dedicado — o módulo nunca escreve no `public` do host.
export const couponsSchema = pgSchema('coupons')

// Enumerações em varchar (sem ENUM nativo); valores espelham as constantes do contracts.
export const campaigns = couponsSchema.table(
  'campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    title: varchar('title', { length: 160 }).notNull().default(''),
    text: text('text').notNull().default(''),
    terms: text('terms').notNull().default(''),
    isActive: boolean('is_active').notNull().default(false),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    discountKind: varchar('discount_kind', { length: 10 }).notNull(),
    discountValue: integer('discount_value').notNull(),
    maxDiscountCents: integer('max_discount_cents'),
    minSubtotalCents: integer('min_subtotal_cents'),
    codeMode: varchar('code_mode', { length: 10 }).notNull(),
    fixedCode: varchar('fixed_code', { length: 32 }),
    codePrefix: varchar('code_prefix', { length: 12 }),
    usageLimitTotal: integer('usage_limit_total'),
    usageLimitPerCustomer: integer('usage_limit_per_customer'),
    usageLimitPerCode: integer('usage_limit_per_code'),
    scope: jsonb('scope').$type<CampaignScope>().notNull().default({ kind: 'all' }),
    isAutomatic: boolean('is_automatic').notNull().default(false),
    leadCapture: jsonb('lead_capture').$type<LeadCaptureSettings>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_campaigns_company_created').on(table.companyId, table.createdAt),
    // Serve `findAutomatic` no carrinho: só campanha automática ligada entra.
    index('idx_campaigns_automatic')
      .on(table.companyId)
      .where(sql`"is_automatic" and "is_active"`),
    check('campaigns_discount_value_positive', sql`"discount_value" > 0`),
    check('campaigns_discount_percent_max', sql`"discount_kind" <> 'percent' or "discount_value" <= 100`),
  ],
)

export type CampaignRow = typeof campaigns.$inferSelect
export type NewCampaignRow = typeof campaigns.$inferInsert

// Um código é único na empresa inteira, não só na campanha: o cliente digita o código, não a campanha.
export const coupons = couponsSchema.table(
  'coupons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 48 }).notNull(),
    leadId: uuid('lead_id'),
    usedCount: integer('used_count').notNull().default(0),
    status: varchar('status', { length: 10 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_coupons_company_code').on(table.companyId, table.code),
    index('idx_coupons_campaign').on(table.campaignId, table.createdAt),
    // Lote: o próximo código livre sai deste índice.
    index('idx_coupons_unassigned')
      .on(table.campaignId)
      .where(sql`"lead_id" is null`),
  ],
)

export type CouponRow = typeof coupons.$inferSelect
export type NewCouponRow = typeof coupons.$inferInsert

// Telefone e e-mail canônicos; a unicidade por campanha é o que deduplica o lead (e fecha a corrida).
export const leads = couponsSchema.table(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }),
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 254 }),
    customerRef: varchar('customer_ref', { length: 120 }),
    couponCode: varchar('coupon_code', { length: 48 }),
    consentText: text('consent_text').notNull(),
    consentedAt: timestamp('consented_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_leads_campaign_phone')
      .on(table.campaignId, table.phone)
      .where(sql`"phone" is not null`),
    uniqueIndex('idx_leads_campaign_email')
      .on(table.campaignId, table.email)
      .where(sql`"email" is not null`),
    index('idx_leads_company_campaign_created').on(table.companyId, table.campaignId, table.createdAt),
  ],
)

export type LeadRow = typeof leads.$inferSelect
export type NewLeadRow = typeof leads.$inferInsert

// Sem ON DELETE: campanha com resgate não se apaga (histórico de desconto concedido).
export const redemptions = couponsSchema.table(
  'redemptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id),
    couponCode: varchar('coupon_code', { length: 48 }),
    orderKind: varchar('order_kind', { length: 40 }).notNull(),
    orderId: varchar('order_id', { length: 120 }).notNull(),
    customerRef: varchar('customer_ref', { length: 120 }),
    subtotalCents: integer('subtotal_cents').notNull(),
    discountCents: integer('discount_cents').notNull(),
    status: varchar('status', { length: 10 }).notNull().default('redeemed'),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }).notNull(),
    releasedAt: timestamp('released_at', { withTimezone: true }),
  },
  (table) => [
    // Um pedido, uma promoção: é o que torna o resgate idempotente por `orderRef`.
    uniqueIndex('idx_redemptions_company_order').on(table.companyId, table.orderKind, table.orderId),
    index('idx_redemptions_campaign_status').on(table.campaignId, table.status, table.redeemedAt),
    index('idx_redemptions_campaign_customer')
      .on(table.campaignId, table.customerRef)
      .where(sql`"status" = 'redeemed'`),
    index('idx_redemptions_campaign_code')
      .on(table.campaignId, table.couponCode)
      .where(sql`"status" = 'redeemed'`),
  ],
)

export type RedemptionRow = typeof redemptions.$inferSelect
export type NewRedemptionRow = typeof redemptions.$inferInsert
