/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  primaryKey,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// Schema Postgres dedicado — o módulo nunca escreve no `public` do host.
export const contentSchema = pgSchema('content')

// `status` em varchar e não ENUM nativo; os valores espelham `POST_STATUS` do contracts.
export const posts = contentSchema.table(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    shortId: varchar('short_id', { length: 6 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    excerpt: varchar('excerpt', { length: 500 }),
    body: text('body').notNull().default(''),
    coverImageUrl: varchar('cover_image_url', { length: 2048 }),
    coverImageAlt: varchar('cover_image_alt', { length: 300 }),
    tags: text('tags').array().notNull().default([]),
    tagLabels: jsonb('tag_labels').$type<Record<string, string>>().notNull().default({}),
    status: varchar('status', { length: 12 }).notNull().default('draft'),
    isTemplate: boolean('is_template').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    authorName: varchar('author_name', { length: 120 }),
    seoTitle: varchar('seo_title', { length: 200 }),
    seoDescription: varchar('seo_description', { length: 320 }),
    canonicalUrl: varchar('canonical_url', { length: 2048 }),
    readingTimeMinutes: integer('reading_time_minutes').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Sem `where deleted_at`: excluir é arquivar, e o slug arquivado continua reservado — reusá-lo
    // faria um link antigo (já compartilhado) abrir outro post.
    uniqueIndex('idx_posts_company_slug').on(table.companyId, table.slug),
    uniqueIndex('idx_posts_company_short_id').on(table.companyId, table.shortId),
    // Serve a listagem pública: empresa + status + ordem por data.
    index('idx_posts_company_status_published').on(table.companyId, table.status, table.publishedAt),
    index('idx_posts_tags').using('gin', table.tags),
    // Serve o `publishDue`: só linha agendada entra, então o índice fica minúsculo.
    index('idx_posts_due')
      .on(table.publishedAt)
      .where(sql`"status" = 'scheduled'`),
  ],
)

export type PostRow = typeof posts.$inferSelect
export type NewPostRow = typeof posts.$inferInsert

// `frequency` em varchar (weekly | monthly), sem ENUM nativo. Posts nunca são apagados, então a
// chave estrangeira para o modelo não precisa de ON DELETE.
export const recurrenceRules = contentSchema.table(
  'recurrence_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => posts.id),
    frequency: varchar('frequency', { length: 10 }).notNull(),
    // Dia do mês da primeira execução: mensal em 31 cai no último dia dos meses curtos e volta ao 31.
    anchorDay: integer('anchor_day').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull(),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    lastPostId: uuid('last_post_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_recurrence_company').on(table.companyId),
    index('idx_recurrence_due')
      .on(table.nextRunAt)
      .where(sql`"is_active"`),
  ],
)

export type RecurrenceRow = typeof recurrenceRules.$inferSelect
export type NewRecurrenceRow = typeof recurrenceRules.$inferInsert

// Slugs que o post já teve: o link antigo continua abrindo o post (e o host o redireciona ao canônico).
export const postFormerSlugs = contentSchema.table(
  'post_former_slugs',
  {
    companyId: uuid('company_id').notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.companyId, table.slug] })],
)
