/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Leitura do site público. Só enxerga post publicado (ou agendado cuja hora chegou) da empresa
 * resolvida pelo host — rascunho, arquivado e agendado futuro respondem 404, igual a inexistente.
 */

import {
  listPublishedPostsQuerySchema,
  normalizeTag,
  parsePostRef,
  PostNotFoundError,
  type ListPublishedPostsQuery,
  type Paginated,
  type PublicPost,
  type PublicPostSummary,
  type TagCount,
} from '@adatechnology/content-contracts'

import { toPagination, toPublicPost, toPublicPostSummary } from '../shared/toContract'
import type { ContentDependencies } from './contentModule.types'

export class GetPublishedPostBySlugUseCase {
  constructor(private readonly dependencies: ContentDependencies) {}

  /**
   * `slug` aceita o endereço canônico `<shortId>-<slug>`, o slug atual e slug antigo. O id curto
   * manda: título/slug editado depois não quebra link compartilhado. O host compara `buildPostRef`
   * do resultado com o pedido e redireciona (301) quando forem diferentes.
   */
  async execute(params: { readonly companyId: string; readonly slug: string }): Promise<PublicPost> {
    const { posts, clock } = this.dependencies
    const parsed = parsePostRef(params.slug)
    const query = { companyId: params.companyId, now: clock.now() }
    const row =
      (parsed.shortId ? await posts.findPublicByShortId({ ...query, shortId: parsed.shortId }) : undefined) ??
      (await posts.findPublicBySlug({ ...query, slug: parsed.slug })) ??
      (await posts.findPublicByFormerSlug({ ...query, slug: parsed.slug }))
    if (!row) throw new PostNotFoundError(parsed.slug)
    return toPublicPost(row)
  }
}

export class ListPublishedPostsUseCase {
  constructor(private readonly dependencies: ContentDependencies) {}

  async execute(
    params: { readonly companyId: string } & Partial<ListPublishedPostsQuery>,
  ): Promise<Paginated<PublicPostSummary>> {
    const { companyId, ...rawQuery } = params
    const query = listPublishedPostsQuerySchema.parse(rawQuery)
    const tag = query.tag ? normalizeTag(query.tag) : undefined
    const page = await this.dependencies.posts.listPublic({
      companyId,
      now: this.dependencies.clock.now(),
      page: query.page,
      pageSize: query.pageSize,
      ...(tag ? { tag } : {}),
    })
    return {
      data: page.rows.map(toPublicPostSummary),
      pagination: toPagination({ total: page.total, page: query.page, pageSize: query.pageSize }),
    }
  }
}

export const TAG_SCOPE = { PUBLIC: 'public', ADMIN: 'admin' } as const
export type TagScope = (typeof TAG_SCOPE)[keyof typeof TAG_SCOPE]

export class ListTagsUseCase {
  constructor(private readonly dependencies: ContentDependencies) {}

  /** `public` conta só posts no ar; `admin` conta todos, para o autor reaproveitar a tag. */
  async execute(params: { readonly companyId: string; readonly scope: TagScope }): Promise<readonly TagCount[]> {
    return this.dependencies.posts.listTags({
      companyId: params.companyId,
      ...(params.scope === TAG_SCOPE.PUBLIC ? { publicAt: this.dependencies.clock.now() } : {}),
    })
  }
}
