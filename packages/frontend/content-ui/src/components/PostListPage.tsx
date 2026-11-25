/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Página pública de lista. Página e tag vêm da URL do host (props) e saem como links, para cada
 * página da lista ser endereçável e indexável.
 */

import type { TagCount } from '@adatechnology/content-contracts'

import { useAsyncResource } from '../hooks/useAsyncResource'
import { useContentPublicApi, useContentText, useRenderLink } from '../providers/ContentProvider'
import { Pagination } from './Pagination'
import { PostCard } from './PostCard'

export type PostListPageProps = {
  readonly page?: number
  readonly tag?: string
  readonly pageSize?: number
  readonly getPostHref: (slug: string) => string
  /** Link de uma página/tag da lista. `tag` ausente = todas. */
  readonly getListHref: (params: { readonly page: number; readonly tag?: string }) => string
  /** Título visível da página. Ausente: sem `<h1>` (o host já tem o dele). */
  readonly title?: string
}

export function PostListPage({ page = 1, tag, pageSize = 10, getPostHref, getListHref, title }: PostListPageProps) {
  const api = useContentPublicApi()
  const { messages } = useContentText()
  const renderLink = useRenderLink()
  const posts = useAsyncResource(
    () => api.listPublishedPosts({ page, pageSize, ...(tag ? { tag } : {}) }),
    JSON.stringify({ page, pageSize, tag }),
  )
  const tags = useAsyncResource<readonly TagCount[]>(
    () => (api.listTags ? api.listTags() : Promise.resolve([])),
    'public-tags',
  )
  const withTag = (target: number) => getListHref({ page: target, ...(tag ? { tag } : {}) })

  return (
    <section className="adc-root adc-public-list">
      {title && <h1 className="adc-page-title">{title}</h1>}

      {(tags.data?.length ?? 0) > 0 && (
        <nav className="adc-tag-filter" aria-label={messages.tagsLabel}>
          {renderLink({
            href: getListHref({ page: 1 }),
            className: `adc-tag-chip${tag ? '' : ' adc-tag-chip--active'}`,
            ...(tag ? {} : { 'aria-current': 'page' as const }),
            children: messages.allTags,
          })}
          {tags.data?.map((entry) =>
            renderLink({
              href: getListHref({ page: 1, tag: entry.tag }),
              className: `adc-tag-chip${entry.tag === tag ? ' adc-tag-chip--active' : ''}`,
              ...(entry.tag === tag ? { 'aria-current': 'page' as const } : {}),
              children: `${entry.tag} (${entry.count})`,
            }),
          )}
        </nav>
      )}

      {posts.isLoading && !posts.data ? (
        <p className="adc-state" role="status">
          {messages.loading}
        </p>
      ) : posts.error !== undefined ? (
        <div className="adc-state adc-state--error" role="alert">
          {messages.loadError}
          <button type="button" className="adc-button" onClick={posts.reload}>
            {messages.retry}
          </button>
        </div>
      ) : (posts.data?.data.length ?? 0) === 0 ? (
        <p className="adc-state">{messages.postsEmpty}</p>
      ) : (
        <div className="adc-card-grid">
          {posts.data?.data.map((post) => (
            <PostCard key={post.id} post={post} href={getPostHref(post.slug)} />
          ))}
        </div>
      )}

      {posts.data && <Pagination page={page} totalPages={posts.data.pagination.totalPages} getPageHref={withTag} />}
    </section>
  )
}
