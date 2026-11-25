/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { index, integer, pgSchema, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

// Schema Postgres dedicado — o módulo nunca escreve no `public` do host.
export const contentSchema = pgSchema('content')

// `status` em varchar e não ENUM nativo; os valores espelham `POST_STATUS` do contracts.
export const posts = contentSchema.table(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    excerpt: varchar('excerpt', { length: 500 }),
    body: text('body').notNull().default(''),
    coverImageUrl: varchar('cover_image_url', { length: 2048 }),
    coverImageAlt: varchar('cover_image_alt', { length: 300 }),
    tags: text('tags').array().notNull().default([]),
    status: varchar('status', { length: 12 }).notNull().default('draft'),
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
    // Serve a listagem pública: empresa + status + ordem por data.
    index('idx_posts_company_status_published').on(table.companyId, table.status, table.publishedAt),
    index('idx_posts_tags').using('gin', table.tags),
  ],
)

export type PostRow = typeof posts.$inferSelect
export type NewPostRow = typeof posts.$inferInsert
