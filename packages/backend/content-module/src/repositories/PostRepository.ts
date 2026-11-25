/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { asc, desc, sql } from 'drizzle-orm'
import type { TagCount } from '@adatechnology/content-contracts'

import type { ContentDatabase } from '../database.types'
import { posts, type NewPostRow, type PostRow } from '../schema/schema'
import type { PostAdminListQuery, PostPage, PostPublicListQuery, PostStorePort } from '../use-cases/contentModule.types'
import {
  postAdminListCondition,
  postOwnedByCondition,
  postPublicCondition,
  postPublicSlugCondition,
  postSlugCondition,
} from './conditions'

const TAG_LIST_LIMIT = 200

export class PostRepository implements PostStorePort {
  constructor(private readonly db: ContentDatabase) {}

  async create(values: NewPostRow): Promise<PostRow> {
    const [row] = await this.db.insert(posts).values(values).returning()
    if (!row) throw new Error('content-module: insert em posts não retornou linha')
    return row
  }

  async findById(params: { companyId: string; id: string }): Promise<PostRow | undefined> {
    const [row] = await this.db.select().from(posts).where(postOwnedByCondition(params)).limit(1)
    return row
  }

  async findBySlug(params: { companyId: string; slug: string }): Promise<PostRow | undefined> {
    const [row] = await this.db.select().from(posts).where(postSlugCondition(params)).limit(1)
    return row
  }

  async findPublicBySlug(params: { companyId: string; slug: string; now: Date }): Promise<PostRow | undefined> {
    const [row] = await this.db.select().from(posts).where(postPublicSlugCondition(params)).limit(1)
    return row
  }

  async update(params: { companyId: string; id: string; values: Partial<NewPostRow> }): Promise<PostRow | undefined> {
    const [row] = await this.db
      .update(posts)
      .set({ ...params.values, updatedAt: new Date() })
      .where(postOwnedByCondition(params))
      .returning()
    return row
  }

  async listForAdmin(query: PostAdminListQuery): Promise<PostPage> {
    const where = postAdminListCondition(query)
    // Mais recente primeiro pela última edição: é o que o painel está mexendo agora.
    const [rows, [counted]] = await Promise.all([
      this.db
        .select()
        .from(posts)
        .where(where)
        .orderBy(desc(posts.updatedAt), asc(posts.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(posts)
        .where(where),
    ])
    return { rows, total: counted?.value ?? 0 }
  }

  async listPublic(query: PostPublicListQuery): Promise<PostPage> {
    const where = postPublicCondition(query)
    const [rows, [counted]] = await Promise.all([
      this.db
        .select()
        .from(posts)
        .where(where)
        .orderBy(desc(posts.publishedAt), asc(posts.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(posts)
        .where(where),
    ])
    return { rows, total: counted?.value ?? 0 }
  }

  async listTags(params: { companyId: string; publicAt?: Date }): Promise<readonly TagCount[]> {
    const where = params.publicAt
      ? postPublicCondition({ companyId: params.companyId, now: params.publicAt })
      : postAdminListCondition({ companyId: params.companyId, now: new Date() })
    // Subconsulta em vez de `group by unnest(...)`: o Postgres não aceita função que devolve
    // conjunto no GROUP BY.
    const postTags = this.db
      .select({ tag: sql<string>`unnest(${posts.tags})`.as('tag') })
      .from(posts)
      .where(where)
      .as('post_tags')
    const rows = await this.db
      .select({ tag: postTags.tag, count: sql<number>`count(*)::int` })
      .from(postTags)
      .groupBy(postTags.tag)
      .orderBy(sql`count(*) desc`, asc(postTags.tag))
      .limit(TAG_LIST_LIMIT)
    return rows
  }
}
