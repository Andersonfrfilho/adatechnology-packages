/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RSS 2.0, Atom 1.0 e sitemap como funções puras: o host pode servir pelas rotas do
 * `content-module` ou gerar no build do site estático, com a mesma saída.
 */

export type FeedChannel = {
  /** Endereço do site, absoluto: `https://exemplo.com`. */
  readonly siteUrl: string
  readonly title: string
  readonly description?: string
  /** `pt-BR`, `en` … */
  readonly language?: string
  /** URL do próprio feed, para o `<atom:link rel="self">` que os leitores exigem. */
  readonly feedUrl?: string
}

export type FeedItem = {
  readonly title: string
  readonly url: string
  readonly publishedAt: string
  readonly updatedAt?: string
  readonly summary?: string
  /** HTML já seguro (saída de `renderMarkdownToHtml`). Vai escapado dentro do XML. */
  readonly contentHtml?: string
  readonly authorName?: string
  readonly categories?: readonly string[]
  readonly imageUrl?: string
}

export type SitemapEntry = { readonly loc: string; readonly lastmod?: string }

export const DEFAULT_POST_PATH_TEMPLATE = '/blog/{slug}'

const XML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

export function escapeXml(value: string): string {
  // Caractere de controle é proibido em XML 1.0: um só deixaria o feed inteiro ilegível.
  return (
    value
      // eslint-disable-next-line no-control-regex -- casar caractere de controle é o objetivo
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
      .replace(/[&<>"']/g, (character) => XML_ESCAPES[character] ?? character)
  )
}

/** `{slug}` no modelo vira o slug codificado; o modelo é relativo ao `siteUrl`. */
export function buildPostUrl(params: {
  readonly siteUrl: string
  readonly slug: string
  readonly postPathTemplate?: string
}): string {
  const base = params.siteUrl.replace(/\/+$/, '')
  const path = (params.postPathTemplate ?? DEFAULT_POST_PATH_TEMPLATE).replace(
    '{slug}',
    encodeURIComponent(params.slug),
  )
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

function toRfc822(iso: string): string {
  return new Date(iso).toUTCString()
}

function rssItem(item: FeedItem): string {
  const parts = [
    `<title>${escapeXml(item.title)}</title>`,
    `<link>${escapeXml(item.url)}</link>`,
    `<guid isPermaLink="true">${escapeXml(item.url)}</guid>`,
    `<pubDate>${toRfc822(item.publishedAt)}</pubDate>`,
  ]
  if (item.summary) parts.push(`<description>${escapeXml(item.summary)}</description>`)
  if (item.contentHtml) parts.push(`<content:encoded>${escapeXml(item.contentHtml)}</content:encoded>`)
  if (item.authorName) parts.push(`<dc:creator>${escapeXml(item.authorName)}</dc:creator>`)
  for (const category of item.categories ?? []) parts.push(`<category>${escapeXml(category)}</category>`)
  if (item.imageUrl) parts.push(`<enclosure url="${escapeXml(item.imageUrl)}" type="image/*" length="0"/>`)
  return `<item>${parts.join('')}</item>`
}

export function buildRssFeed(params: { readonly channel: FeedChannel; readonly items: readonly FeedItem[] }): string {
  const { channel } = params
  const head = [
    `<title>${escapeXml(channel.title)}</title>`,
    `<link>${escapeXml(channel.siteUrl)}</link>`,
    `<description>${escapeXml(channel.description ?? channel.title)}</description>`,
  ]
  if (channel.language) head.push(`<language>${escapeXml(channel.language)}</language>`)
  if (channel.feedUrl)
    head.push(`<atom:link href="${escapeXml(channel.feedUrl)}" rel="self" type="application/rss+xml"/>`)
  const latest = params.items[0]
  if (latest) head.push(`<lastBuildDate>${toRfc822(latest.updatedAt ?? latest.publishedAt)}</lastBuildDate>`)

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    `<channel>${head.join('')}${params.items.map(rssItem).join('')}</channel></rss>\n`
  )
}

function atomEntry(item: FeedItem): string {
  const parts = [
    `<title>${escapeXml(item.title)}</title>`,
    `<link href="${escapeXml(item.url)}"/>`,
    `<id>${escapeXml(item.url)}</id>`,
    `<published>${new Date(item.publishedAt).toISOString()}</published>`,
    `<updated>${new Date(item.updatedAt ?? item.publishedAt).toISOString()}</updated>`,
  ]
  if (item.summary) parts.push(`<summary>${escapeXml(item.summary)}</summary>`)
  if (item.contentHtml) parts.push(`<content type="html">${escapeXml(item.contentHtml)}</content>`)
  if (item.authorName) parts.push(`<author><name>${escapeXml(item.authorName)}</name></author>`)
  for (const category of item.categories ?? []) parts.push(`<category term="${escapeXml(category)}"/>`)
  return `<entry>${parts.join('')}</entry>`
}

export function buildAtomFeed(params: {
  readonly channel: FeedChannel
  readonly items: readonly FeedItem[]
  readonly now?: Date
}): string {
  const { channel } = params
  const latest = params.items[0]
  const updated = latest ? new Date(latest.updatedAt ?? latest.publishedAt) : (params.now ?? new Date())
  const head = [
    `<title>${escapeXml(channel.title)}</title>`,
    `<id>${escapeXml(channel.feedUrl ?? channel.siteUrl)}</id>`,
    `<link href="${escapeXml(channel.siteUrl)}"/>`,
    `<updated>${updated.toISOString()}</updated>`,
  ]
  if (channel.feedUrl) head.push(`<link rel="self" href="${escapeXml(channel.feedUrl)}"/>`)
  if (channel.description) head.push(`<subtitle>${escapeXml(channel.description)}</subtitle>`)
  const language = channel.language ? ` xml:lang="${escapeXml(channel.language)}"` : ''

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<feed xmlns="http://www.w3.org/2005/Atom"${language}>${head.join('')}${params.items.map(atomEntry).join('')}</feed>\n`
  )
}

export function buildSitemapXml(entries: readonly SitemapEntry[]): string {
  const urls = entries
    .map(
      (entry) =>
        `<url><loc>${escapeXml(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ''}</url>`,
    )
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`
}
