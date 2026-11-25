/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { buildExcerpt, type PublicPost } from '@adatechnology/content-contracts'

export type PostMeta = {
  readonly title: string
  readonly description: string
  readonly canonicalUrl: string
  readonly openGraph: {
    readonly type: 'article'
    readonly title: string
    readonly description: string
    readonly url: string
    readonly image?: string
    readonly imageAlt?: string
    readonly publishedTime: string
    readonly modifiedTime: string
    readonly tags: readonly string[]
  }
}

/**
 * Metadados para o `<head>` do host (Next `generateMetadata`, react-helmet, SSR manual). O pacote
 * não toca no `<head>`: quem é dono do documento é o host.
 */
export function buildPostMeta(
  post: PublicPost,
  params: { readonly url: string; readonly siteName?: string },
): PostMeta {
  const baseTitle = post.seoTitle ?? post.title
  const title = params.siteName ? `${baseTitle} | ${params.siteName}` : baseTitle
  const description = post.seoDescription ?? post.excerpt ?? buildExcerpt(post.body, 160)
  const url = post.canonicalUrl ?? params.url
  return {
    title,
    description,
    canonicalUrl: url,
    openGraph: {
      type: 'article',
      title: baseTitle,
      description,
      url,
      ...(post.coverImageUrl ? { image: post.coverImageUrl } : {}),
      ...(post.coverImageAlt ? { imageAlt: post.coverImageAlt } : {}),
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      tags: post.tags,
    },
  }
}
