/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { buildAtomFeed, buildPostUrl, buildRssFeed, buildSitemapXml } from './feed'
import { createPostSchema, listPostsQuerySchema, publishPostSchema } from './schemas'

const channel = {
  siteUrl: 'https://example.com',
  title: 'Novidades & dicas',
  language: 'pt-BR',
  feedUrl: 'https://example.com/feed.xml',
}
const item = {
  title: 'Post <um>',
  url: 'https://example.com/blog/post-um',
  publishedAt: '2026-11-20T12:00:00.000Z',
  summary: 'Resumo "citado"',
  contentHtml: '<p>corpo</p>',
  categories: ['dicas'],
}

describe('feeds', () => {
  it('monta a URL do post pelo modelo', () => {
    expect(buildPostUrl({ siteUrl: 'https://example.com/', slug: 'meu-post' })).toBe(
      'https://example.com/blog/meu-post',
    )
    expect(buildPostUrl({ siteUrl: 'https://example.com', slug: 'a', postPathTemplate: 'noticias/{slug}' })).toBe(
      'https://example.com/noticias/a',
    )
  })

  it('RSS escapa todo texto e traz o self link', () => {
    const xml = buildRssFeed({ channel, items: [item] })
    expect(xml).toContain('<title>Novidades &amp; dicas</title>')
    expect(xml).toContain('<title>Post &lt;um&gt;</title>')
    expect(xml).toContain('<content:encoded>&lt;p&gt;corpo&lt;/p&gt;</content:encoded>')
    expect(xml).toContain('rel="self"')
    expect(xml).toContain('<pubDate>Fri, 20 Nov 2026 12:00:00 GMT</pubDate>')
  })

  it('Atom traz updated e entradas', () => {
    const xml = buildAtomFeed({ channel, items: [item] })
    expect(xml).toContain('<updated>2026-11-20T12:00:00.000Z</updated>')
    expect(xml).toContain('<category term="dicas"/>')
    expect(xml).toContain('xml:lang="pt-BR"')
  })

  it('remove caractere de controle que invalidaria o XML', () => {
    expect(buildRssFeed({ channel, items: [{ ...item, title: 'a\u0001b' }] })).toContain('<title>ab</title>')
  })

  it('sitemap', () => {
    expect(buildSitemapXml([{ loc: 'https://example.com/blog/a?x=1&y=2', lastmod: '2026-11-20' }])).toContain(
      '<loc>https://example.com/blog/a?x=1&amp;y=2</loc><lastmod>2026-11-20</lastmod>',
    )
  })
})

describe('schemas', () => {
  it('recusa campo desconhecido (status/companyId pelo corpo)', () => {
    expect(createPostSchema.safeParse({ title: 'a', status: 'published' }).success).toBe(false)
    expect(createPostSchema.safeParse({ title: 'a', companyId: 'x' }).success).toBe(false)
  })

  it('recusa capa e canonical fora de http(s)', () => {
    expect(createPostSchema.safeParse({ title: 'a', coverImageUrl: 'javascript:alert(1)' }).success).toBe(false)
    expect(createPostSchema.safeParse({ title: 'a', canonicalUrl: 'ftp://x.com/a' }).success).toBe(false)
    expect(createPostSchema.safeParse({ title: 'a', canonicalUrl: 'https://x.com/a' }).success).toBe(true)
  })

  it('recusa slug inválido e aceita o normalizado', () => {
    expect(createPostSchema.safeParse({ title: 'a', slug: 'com espaço' }).success).toBe(false)
    expect(createPostSchema.parse({ title: 'a', slug: 'Meu-Post' }).slug).toBe('meu-post')
  })

  it('publish aceita data com fuso', () => {
    expect(publishPostSchema.safeParse({ publishedAt: '2026-12-01T10:00:00-03:00' }).success).toBe(true)
    expect(publishPostSchema.safeParse({ publishedAt: 'amanhã' }).success).toBe(false)
  })

  it('query de listagem converte números e limita o tamanho da página', () => {
    expect(listPostsQuerySchema.parse({ page: '2' })).toEqual({ page: 2, pageSize: 20 })
    expect(listPostsQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false)
  })
})
