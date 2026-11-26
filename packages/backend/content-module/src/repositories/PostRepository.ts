/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { POST_STATUS, type PostCounts, type TagCount } from '@adatechnology/content-contracts'

import type { ContentDatabase } from '../database.types'
import { postFormerSlugs, posts, type NewPostRow, type PostRow } from '../schema/schema'
import type { PostAdminListQuery, PostPage, PostPublicListQuery, PostStorePort } from '../use-cases/contentModule.types'
import {
  postAdminListCondition,
  postDueCondition,
  postOwnedByCondition,
  postPublicCondition,
  postPublicShortIdCondition,
  postShortIdCondition,
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

  async findByShortId(params: { companyId: string; shortId: string }): Promise<PostRow | undefined> {
    const [row] = await this.db.select().from(posts).where(postShortIdCondition(params)).limit(1)
    return row
  }

  async findPublicByShortId(params: { companyId: string; shortId: string; now: Date }): Promise<PostRow | undefined> {
    const [row] = await this.db.select().from(posts).where(postPublicShortIdCondition(params)).limit(1)
    return row
  }

  async findPublicByFormerSlug(params: { companyId: string; slug: string; now: Date }): Promise<PostRow | undefined> {
    const [former] = await this.db
      .select({ postId: postFormerSlugs.postId })
      .from(postFormerSlugs)
      .where(and(eq(postFormerSlugs.companyId, params.companyId), eq(postFormerSlugs.slug, params.slug)))
      .limit(1)
    if (!former) return undefined
    const [row] = await this.db
      .select()
      .from(posts)
      .where(and(postPublicCondition(params), eq(posts.id, former.postId)))
      .limit(1)
    return row
  }

  async recordFormerSlug(params: { companyId: string; postId: string; slug: string }): Promise<void> {
    await this.db.insert(postFormerSlugs).values(params).onConflictDoNothing()
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

  async countByStatus(params: { companyId: string; now: Date }): Promise<PostCounts> {
    const { now } = params
    const counted = (condition: ReturnType<typeof sql>) => sql<number>`count(*) filter (where ${condition})::int`
    const livePublished = sql`(${posts.status} = ${POST_STATUS.PUBLISHED} or (${posts.status} = ${POST_STATUS.SCHEDULED} and ${posts.publishedAt} <= ${now}))`
    const [row] = await this.db
      .select({
        published: counted(sql`not ${posts.isTemplate} and ${livePublished}`),
        scheduled: counted(
          sql`not ${posts.isTemplate} and ${posts.status} = ${POST_STATUS.SCHEDULED} and ${posts.publishedAt} > ${now}`,
        ),
        draft: counted(sql`not ${posts.isTemplate} and ${posts.status} = ${POST_STATUS.DRAFT}`),
        archived: counted(sql`not ${posts.isTemplate} and ${posts.status} = ${POST_STATUS.ARCHIVED}`),
        templates: counted(sql`${posts.isTemplate} and ${posts.status} <> ${POST_STATUS.ARCHIVED}`),
      })
      .from(posts)
      .where(eq(posts.companyId, params.companyId))
    return row ?? { published: 0, scheduled: 0, draft: 0, archived: 0, templates: 0 }
  }

  async claimDueScheduled(params: { now: Date; limit: number }): Promise<readonly PostRow[]> {
    // Um único UPDATE com a seleção travada por dentro: quem chega depois pula as linhas já travadas
    // e não as enxerga mais como agendadas — nenhum post é marcado nem notificado duas vezes.
    const due = this.db
      .select({ id: posts.id })
      .from(posts)
      .where(postDueCondition({ now: params.now }))
      .orderBy(asc(posts.publishedAt), asc(posts.id))
      .limit(params.limit)
      .for('update', { skipLocked: true })
    return this.db.update(posts).set({ status: POST_STATUS.PUBLISHED }).where(inArray(posts.id, due)).returning()
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
