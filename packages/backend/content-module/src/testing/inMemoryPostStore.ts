/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Dublê em memória do `PostStorePort`, para a suíte de comportamento do módulo e para o teste do
 * host. O isolamento real (cláusula SQL) é provado em `repositories/isolation.test.ts`; aqui as
 * mesmas regras são reproduzidas em JavaScript, inclusive a violação de índice único do slug.
 */

import { randomUUID } from 'node:crypto'
import { POST_STATUS, type TagCount } from '@adatechnology/content-contracts'

import type { NewPostRow, PostRow } from '../schema/schema'
import { effectiveStatus } from '../shared/toContract'
import type { PostAdminListQuery, PostPage, PostPublicListQuery, PostStorePort } from '../use-cases/contentModule.types'

function isPublic(row: PostRow, now: Date): boolean {
  const live = row.status === POST_STATUS.PUBLISHED || row.status === POST_STATUS.SCHEDULED
  return live && row.publishedAt !== null && row.publishedAt <= now
}

function paginate(rows: PostRow[], page: number, pageSize: number): PostPage {
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize).map((row) => ({ ...row })), total: rows.length }
}

class UniqueViolation extends Error {
  readonly code = '23505'
}

export function createInMemoryPostStore(seed: PostRow[] = []): PostStorePort & { readonly rows: PostRow[] } {
  const rows: PostRow[] = [...seed]

  const assertUniqueSlug = (companyId: string, slug: string, ownId?: string): void => {
    if (rows.some((row) => row.companyId === companyId && row.slug === slug && row.id !== ownId)) {
      throw new UniqueViolation('duplicate key value violates unique constraint "idx_posts_company_slug"')
    }
  }

  return {
    rows,

    async create(values: NewPostRow): Promise<PostRow> {
      assertUniqueSlug(values.companyId, values.slug)
      const now = new Date()
      const row: PostRow = {
        id: randomUUID(),
        excerpt: null,
        body: '',
        coverImageUrl: null,
        coverImageAlt: null,
        tags: [],
        status: POST_STATUS.DRAFT,
        publishedAt: null,
        authorName: null,
        seoTitle: null,
        seoDescription: null,
        canonicalUrl: null,
        readingTimeMinutes: 1,
        createdAt: now,
        updatedAt: now,
        ...values,
      } as PostRow
      rows.push(row)
      return { ...row }
    },

    async findById({ companyId, id }) {
      const row = rows.find((candidate) => candidate.companyId === companyId && candidate.id === id)
      return row ? { ...row } : undefined
    },

    async findBySlug({ companyId, slug }) {
      const row = rows.find((candidate) => candidate.companyId === companyId && candidate.slug === slug)
      return row ? { ...row } : undefined
    },

    async findPublicBySlug({ companyId, slug, now }) {
      const row = rows.find(
        (candidate) => candidate.companyId === companyId && candidate.slug === slug && isPublic(candidate, now),
      )
      return row ? { ...row } : undefined
    },

    async update({ companyId, id, values }) {
      const row = rows.find((candidate) => candidate.companyId === companyId && candidate.id === id)
      if (!row) return undefined
      if (values.slug !== undefined) assertUniqueSlug(companyId, values.slug, id)
      Object.assign(row, values, { updatedAt: new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1)) })
      return { ...row }
    },

    async listForAdmin(query: PostAdminListQuery) {
      const search = query.search?.toLowerCase()
      const matched = rows
        .filter((row) => row.companyId === query.companyId)
        .filter((row) => !query.status || effectiveStatus(row, query.now) === query.status)
        .filter((row) => !query.tag || row.tags.includes(query.tag))
        .filter((row) => !search || row.title.toLowerCase().includes(search) || row.slug.includes(search))
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
      return paginate(matched, query.page, query.pageSize)
    },

    async listPublic(query: PostPublicListQuery) {
      const matched = rows
        .filter((row) => row.companyId === query.companyId && isPublic(row, query.now))
        .filter((row) => !query.tag || row.tags.includes(query.tag))
        .sort((left, right) => (right.publishedAt?.getTime() ?? 0) - (left.publishedAt?.getTime() ?? 0))
      return paginate(matched, query.page, query.pageSize)
    },

    async listTags({ companyId, publicAt }): Promise<readonly TagCount[]> {
      const counts = new Map<string, number>()
      for (const row of rows) {
        if (row.companyId !== companyId || (publicAt && !isPublic(row, publicAt))) continue
        for (const tag of row.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
      return [...counts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
    },
  }
}
