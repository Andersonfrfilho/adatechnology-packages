/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { formatTagLabel, type PublicPost } from '@adatechnology/content-contracts'
import { useEffect, type ReactNode } from 'react'

import { useAsyncResource } from '../hooks/useAsyncResource'
import { formatPostDate } from '../lib/format'
import type { ShareNetwork } from '../lib/share'
import { useContentPublicApi, useContentText, useRenderLink } from '../providers/ContentProvider'
import { MarkdownContent } from './MarkdownContent'
import { ShareButtons } from './ShareButtons'

export type PostPageProps = {
  readonly slug: string
  /** URL compartilhada. Padrão: o endereço atual do navegador. */
  readonly shareUrl?: string
  /** Redes de compartilhamento; lista vazia esconde o bloco. */
  readonly shareNetworks?: readonly ShareNetwork[]
  /** Ausente: tags sem link. */
  readonly getTagHref?: (tag: string) => string
  /** Para o host montar `<title>`/meta (ver `buildPostMeta`). */
  readonly onLoaded?: (post: PublicPost) => void
  readonly renderNotFound?: () => ReactNode
}

export function PostPage({ slug, shareUrl, shareNetworks, getTagHref, onLoaded, renderNotFound }: PostPageProps) {
  const api = useContentPublicApi()
  const { messages, locale, format } = useContentText()
  const renderLink = useRenderLink()
  const resource = useAsyncResource(() => api.getPublishedPost(slug), slug)
  const post = resource.data

  useEffect(() => {
    if (post) onLoaded?.(post)
  }, [post, onLoaded])

  if (resource.isLoading && !post) {
    return (
      <p className="adc-root adc-state" role="status">
        {messages.loading}
      </p>
    )
  }
  if (!post) {
    return <>{renderNotFound ? renderNotFound() : <p className="adc-root adc-state">{messages.notFound}</p>}</>
  }

  const url = shareUrl ?? (typeof window !== 'undefined' ? window.location.href : '')

  return (
    <article className="adc-root adc-post">
      <header className="adc-post-header">
        <h1 className="adc-page-title">{post.title}</h1>
        <p className="adc-meta">
          <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt, locale)}</time>
          <span aria-hidden="true"> · </span>
          {format('readingTime', { minutes: post.readingTimeMinutes })}
          {post.authorName && (
            <>
              <span aria-hidden="true"> · </span>
              {format('byAuthor', { author: post.authorName })}
            </>
          )}
        </p>
        {post.tags.length > 0 && (
          <ul className="adc-tag-list">
            {post.tags.map((tag) => (
              <li key={tag} className="adc-tag">
                {getTagHref
                  ? renderLink({ href: getTagHref(tag), children: formatTagLabel(tag, post.tagLabels) })
                  : formatTagLabel(tag, post.tagLabels)}
              </li>
            ))}
          </ul>
        )}
      </header>
      {post.coverImageUrl && (
        <img className="adc-post-cover" src={post.coverImageUrl} alt={post.coverImageAlt ?? ''} decoding="async" />
      )}
      <MarkdownContent markdown={post.body} headingLevelOffset={1} />
      {url && shareNetworks?.length !== 0 && (
        <ShareButtons url={url} title={post.title} {...(shareNetworks ? { networks: shareNetworks } : {})} />
      )}
    </article>
  )
}
