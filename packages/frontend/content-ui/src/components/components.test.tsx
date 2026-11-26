/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Renderização no servidor (sem DOM) das peças públicas: o corpo do post não vira HTML cru.
 */

import { describe, expect, it } from 'bun:test'
import type { PublicPostSummary } from '@adatechnology/content-contracts'
import { renderToStaticMarkup } from 'react-dom/server'

import { ContentProvider } from '../providers/ContentProvider'
import { MarkdownContent } from './MarkdownContent'
import { PostCard } from './PostCard'
import { ShareButtons } from './ShareButtons'

describe('MarkdownContent', () => {
  it('não injeta HTML do autor nem link perigoso', () => {
    const html = renderToStaticMarkup(
      <MarkdownContent
        markdown={'<script>alert(1)</script>\n\n[x](javascript:alert(1)) <img src=x onerror=alert(1)>'}
      />,
    )
    expect(html).not.toMatch(/<script|<img|javascript:/i)
    expect(html).toContain('&lt;script&gt;')
  })

  it('desloca títulos e põe rel nos links', () => {
    const html = renderToStaticMarkup(
      <MarkdownContent markdown={'# Oi\n\n[site](https://example.com)'} headingLevelOffset={1} />,
    )
    expect(html).toContain('<h2 id="oi">Oi</h2>')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('target="_blank"')
  })

  it('mesma saída estrutural do renderizador de string', () => {
    const html = renderToStaticMarkup(<MarkdownContent markdown={'- a\n- b\n\n> c'} />)
    expect(html).toContain('<ul><li><span>a</span></li><li><span>b</span></li></ul><blockquote><p>c</p></blockquote>')
  })
})

const summary: PublicPostSummary = {
  id: 'p1',
  slug: 'ola',
  shortId: 'abc123',
  tagLabels: {},
  title: 'Olá <mundo>',
  excerpt: 'Resumo',
  coverImageUrl: null,
  coverImageAlt: null,
  tags: ['dicas'],
  publishedAt: '2026-11-20T12:00:00.000Z',
  updatedAt: '2026-11-20T12:00:00.000Z',
  authorName: null,
  seoTitle: null,
  seoDescription: null,
  canonicalUrl: null,
  readingTimeMinutes: 4,
}

describe('PostCard e ShareButtons', () => {
  it('card em inglês com link do host', () => {
    const html = renderToStaticMarkup(
      <ContentProvider locale="en">
        <PostCard post={summary} href="/blog/ola" />
      </ContentProvider>,
    )
    expect(html).toContain('href="/blog/ola"')
    expect(html).toContain('Olá &lt;mundo&gt;')
    expect(html).toContain('4 min read')
  })

  it('renderLink do host substitui o <a>', () => {
    const html = renderToStaticMarkup(
      <ContentProvider renderLink={({ href, children }) => <span data-href={href}>{children}</span>}>
        <PostCard post={summary} href="/blog/ola" />
      </ContentProvider>,
    )
    expect(html).toContain('data-href="/blog/ola"')
  })

  it('compartilhar sai como links simples, sem script de terceiro', () => {
    const html = renderToStaticMarkup(
      <ContentProvider>
        <ShareButtons url="https://example.com/blog/ola" title="Olá" />
      </ContentProvider>,
    )
    expect(html).toContain('href="https://wa.me/?text=')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).not.toContain('<script')
  })
})
