/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  POST_STATUS,
  type Pagination,
  type Post,
  type PostStatus,
  type PostSummary,
  type PublicPost,
  type PublicPostSummary,
} from '@adatechnology/content-contracts'

import type { PostRow } from '../schema/schema'

/** Agendado cuja hora já passou é publicado: o painel mostra o estado que o leitor vê. */
export function effectiveStatus(row: PostRow, now: Date): PostStatus {
  if (row.status === POST_STATUS.SCHEDULED && row.publishedAt && row.publishedAt <= now) return POST_STATUS.PUBLISHED
  return row.status as PostStatus
}

export function toPostSummary(row: PostRow, now: Date): PostSummary {
  return {
    id: row.id,
    companyId: row.companyId,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    coverImageUrl: row.coverImageUrl,
    coverImageAlt: row.coverImageAlt,
    tags: row.tags,
    status: effectiveStatus(row, now),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    authorName: row.authorName,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    canonicalUrl: row.canonicalUrl,
    readingTimeMinutes: row.readingTimeMinutes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toPost(row: PostRow, now: Date): Post {
  return { ...toPostSummary(row, now), body: row.body }
}

/** Só chamado sobre linha que passou pela condição pública — `publishedAt` existe. */
export function toPublicPostSummary(row: PostRow): PublicPostSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    coverImageUrl: row.coverImageUrl,
    coverImageAlt: row.coverImageAlt,
    tags: row.tags,
    publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    authorName: row.authorName,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    canonicalUrl: row.canonicalUrl,
    readingTimeMinutes: row.readingTimeMinutes,
  }
}

export function toPublicPost(row: PostRow): PublicPost {
  return { ...toPublicPostSummary(row), body: row.body }
}

export function toPagination(params: { total: number; page: number; pageSize: number }): Pagination {
  return { ...params, totalPages: Math.max(1, Math.ceil(params.total / params.pageSize)) }
}
