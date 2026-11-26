/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RSS, Atom e entradas de sitemap do site público, a partir de `config.feed`. Sem essa config os
 * use-cases nem são construídos e as rotas não sobem.
 */

import {
  buildAtomFeed,
  buildExcerpt,
  buildPostUrl,
  buildRssFeed,
  renderMarkdownToHtml,
  type ContentFeedConfig,
  type FeedChannel,
  type FeedItem,
  type SitemapEntry,
} from '@adatechnology/content-contracts'

import type { PostRow } from '../schema/schema'
import type { ContentDependencies } from './contentModule.types'

const DEFAULT_ITEM_LIMIT = 20
// O protocolo de sitemap aceita até 50 mil URLs por arquivo; blog real fica muito abaixo disso.
const SITEMAP_LIMIT = 50_000

export const FEED_FORMAT = { RSS: 'rss', ATOM: 'atom' } as const
export type FeedFormat = (typeof FEED_FORMAT)[keyof typeof FEED_FORMAT]

export class BuildFeedUseCase {
  constructor(
    private readonly dependencies: ContentDependencies,
    private readonly feed: ContentFeedConfig,
  ) {}

  async execute(params: {
    readonly companyId: string
    readonly format: FeedFormat
    readonly feedUrl?: string
  }): Promise<string> {
    const now = this.dependencies.clock.now()
    const page = await this.dependencies.posts.listPublic({
      companyId: params.companyId,
      now,
      page: 1,
      pageSize: this.feed.itemLimit ?? DEFAULT_ITEM_LIMIT,
    })
    const channel: FeedChannel = {
      siteUrl: this.feed.siteUrl,
      title: this.feed.title,
      ...(this.feed.description ? { description: this.feed.description } : {}),
      ...(this.feed.language ? { language: this.feed.language } : {}),
      ...(params.feedUrl ? { feedUrl: params.feedUrl } : {}),
    }
    const items = page.rows.map((row) => this.toItem(row))
    return params.format === FEED_FORMAT.ATOM
      ? buildAtomFeed({ channel, items, now })
      : buildRssFeed({ channel, items })
  }

  private toItem(row: PostRow): FeedItem {
    return {
      title: row.title,
      url: buildPostUrl({
        siteUrl: this.feed.siteUrl,
        slug: row.slug,
        shortId: row.shortId,
        postPathTemplate: this.feed.postPathTemplate,
      }),
      publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      summary: row.excerpt ?? buildExcerpt(row.body),
      ...((this.feed.includeContent ?? true)
        ? { contentHtml: renderMarkdownToHtml(row.body, { headingIds: false }) }
        : {}),
      ...(row.authorName ? { authorName: row.authorName } : {}),
      categories: row.tags,
      ...(row.coverImageUrl ? { imageUrl: row.coverImageUrl } : {}),
    }
  }
}

export class ListSitemapEntriesUseCase {
  constructor(
    private readonly dependencies: ContentDependencies,
    private readonly feed: ContentFeedConfig,
  ) {}

  /** Entradas para o host juntar ao sitemap dele — o módulo não é dono do sitemap do site. */
  async execute(params: { readonly companyId: string }): Promise<readonly SitemapEntry[]> {
    const page = await this.dependencies.posts.listPublic({
      companyId: params.companyId,
      now: this.dependencies.clock.now(),
      page: 1,
      pageSize: SITEMAP_LIMIT,
    })
    return page.rows.map((row) => ({
      loc: buildPostUrl({
        siteUrl: this.feed.siteUrl,
        slug: row.slug,
        shortId: row.shortId,
        postPathTemplate: this.feed.postPathTemplate,
      }),
      lastmod: row.updatedAt.toISOString(),
    }))
  }
}
