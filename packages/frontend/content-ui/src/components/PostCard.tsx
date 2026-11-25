/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PublicPostSummary } from '@adatechnology/content-contracts'

import { formatPostDate } from '../lib/format'
import { useContentText, useRenderLink } from '../providers/ContentProvider'

export type PostCardProps = {
  readonly post: PublicPostSummary
  readonly href: string
  /** Nível do título do card na página do host. Padrão: 2. */
  readonly headingLevel?: 2 | 3 | 4
}

export function PostCard({ post, href, headingLevel = 2 }: PostCardProps) {
  const { messages, locale, format } = useContentText()
  const renderLink = useRenderLink()
  const Heading = `h${headingLevel}` as const

  return (
    <article className="adc-card">
      {post.coverImageUrl && (
        <img
          className="adc-card-cover"
          src={post.coverImageUrl}
          alt={post.coverImageAlt ?? ''}
          loading="lazy"
          decoding="async"
        />
      )}
      <div className="adc-card-body">
        <Heading className="adc-card-title">
          {renderLink({ href, className: 'adc-card-link', children: post.title })}
        </Heading>
        <p className="adc-meta">
          <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt, locale)}</time>
          <span aria-hidden="true"> · </span>
          {format('readingTime', { minutes: post.readingTimeMinutes })}
        </p>
        {post.excerpt && <p className="adc-card-excerpt">{post.excerpt}</p>}
        {post.tags.length > 0 && (
          <ul className="adc-tag-list">
            {post.tags.map((tag) => (
              <li key={tag} className="adc-tag">
                {tag}
              </li>
            ))}
          </ul>
        )}
        <span className="adc-card-more" aria-hidden="true">
          {messages.readMore}
        </span>
      </div>
    </article>
  )
}
