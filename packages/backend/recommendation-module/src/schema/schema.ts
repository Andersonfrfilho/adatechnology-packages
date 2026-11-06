/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Schema próprio (`pgSchema('recommendation')`), como os demais módulos com estado: o host nunca
 * versiona estas tabelas, e um upgrade do pacote não parece migration do produto.
 */

import { sql } from 'drizzle-orm'
import {
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const recommendationSchema = pgSchema('recommendation')

/**
 * Campanha "nenhuma" na estatística. A chave única da estatística inclui a campanha, e `NULL` não
 * colide com `NULL` num índice único — duas impressões orgânicas do mesmo dia virariam duas linhas.
 */
export const NO_CAMPAIGN_ID = '00000000-0000-0000-0000-000000000000'

export const items = recommendationSchema.table(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** `null` em single-tenant. */
    companyId: uuid('company_id'),
    kind: varchar('kind', { length: 40 }).notNull(),
    source: varchar('source', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    title: varchar('title', { length: 160 }).notNull(),
    summary: varchar('summary', { length: 500 }),
    imageUrl: text('image_url'),
    linkUrl: text('link_url'),
    city: varchar('city', { length: 120 }),
    state: varchar('state', { length: 2 }),
    minAge: smallint('min_age'),
    maxAge: smallint('max_age'),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    attributes: jsonb('attributes').notNull().default({}),
    /** Anunciante no `customer-module`. Sem FK: outro schema, outro journal. */
    sponsorId: uuid('sponsor_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_items_company_status').on(table.companyId, table.status, table.source),
    index('idx_items_sponsor')
      .on(table.sponsorId)
      .where(sql`${table.sponsorId} is not null`),
    index('idx_items_tags').using('gin', table.tags),
  ],
)

export const campaigns = recommendationSchema.table(
  'campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id'),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    plan: varchar('plan', { length: 40 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    priority: integer('priority').notNull().default(0),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    placements: text('placements')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** Assinatura ou cobrança que paga a campanha, quando houver. */
    externalReference: varchar('external_reference', { length: 200 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_campaigns_item').on(table.itemId),
    // O feed procura campanha ativa no período; o índice parcial fica do tamanho do que está no ar.
    index('idx_campaigns_live')
      .on(table.companyId, table.startsAt, table.endsAt)
      .where(sql`${table.status} = 'active'`),
  ],
)

/**
 * Contagem por dia, e não um evento por linha: o anunciante quer o total, e uma linha por
 * impressão guardaria — sem necessidade — quem viu o quê e quando.
 */
export const dailyStats = recommendationSchema.table(
  'daily_stats',
  {
    companyId: uuid('company_id'),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id').notNull().default(NO_CAMPAIGN_ID),
    placement: varchar('placement', { length: 40 }).notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    impressions: integer('impressions').notNull().default(0),
    clicks: integer('clicks').notNull().default(0),
  },
  (table) => [
    uniqueIndex('idx_daily_stats_key').on(table.itemId, table.campaignId, table.placement, table.day),
    index('idx_daily_stats_day').on(table.companyId, table.day),
  ],
)

export type ItemRow = typeof items.$inferSelect
export type NewItemRow = typeof items.$inferInsert
export type CampaignRow = typeof campaigns.$inferSelect
export type NewCampaignRow = typeof campaigns.$inferInsert
