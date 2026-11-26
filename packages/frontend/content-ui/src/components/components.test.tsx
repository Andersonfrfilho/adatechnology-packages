/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Renderização no servidor (sem DOM) das peças públicas: o corpo do post não vira HTML cru.
 */

import { describe, expect, it } from 'bun:test'
import type { PublicPostSummary } from '@adatechnology/content-contracts'
import { renderToStaticMarkup } from 'react-dom/server'

import { ContentProvider } from '../providers/ContentProvider'
import type { ContentAdminApi } from '../providers/types'
import { EmojiPicker } from './EmojiPicker'
import { FilePicker } from './FilePicker'
import { MarkdownContent } from './MarkdownContent'
import { MarkdownEditor } from './MarkdownEditor'
import { PostCard } from './PostCard'
import { PostEditor } from './PostEditor'
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

describe('editor de corpo', () => {
  const editorHtml = (props: { showToolbar?: boolean } = {}) =>
    renderToStaticMarkup(
      <ContentProvider>
        <MarkdownEditor value="**oi**" onChange={() => undefined} labelledBy="x" {...props} />
      </ContentProvider>,
    )

  it('mostra a barra com botões rotulados e atalhos nos títulos', () => {
    const html = editorHtml()
    expect(html).toContain('role="toolbar"')
    for (const label of ['Negrito (Ctrl+B)', 'Itálico (Ctrl+I)', 'Link (Ctrl+K)', 'Imagem', 'Emoji', 'Lista numerada'])
      expect(html).toContain(`aria-label="${label}"`)
    expect(html).toContain('**oi**')
  })

  it('esconde a barra por prop e mantém o textarea', () => {
    const html = editorHtml({ showToolbar: false })
    expect(html).not.toContain('role="toolbar"')
    expect(html).toContain('<textarea')
  })

  it('seletor de arquivo usa textos em pt-BR, não o do navegador', () => {
    const html = renderToStaticMarkup(
      <ContentProvider>
        <FilePicker
          buttonLabel="Enviar imagem"
          emptyLabel="Nenhum arquivo escolhido"
          accept="image/*"
          onPick={() => undefined}
        />
      </ContentProvider>,
    )
    expect(html).toContain('Enviar imagem')
    expect(html).toContain('Nenhum arquivo escolhido')
    expect(html).toMatch(/<input[^>]*hidden/)
  })

  it('emoji: categorias e grade acessíveis', () => {
    const html = renderToStaticMarkup(
      <ContentProvider>
        <EmojiPicker onPick={() => undefined} onClose={() => undefined} />
      </ContentProvider>,
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain('Rostos')
    expect(html).toContain('😀')
  })
})

describe('PostEditor: pontos de customização', () => {
  const adminApi = {
    listPosts: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
    getPost: async () => {
      throw new Error('n/a')
    },
    createPost: async () => {
      throw new Error('n/a')
    },
    updatePost: async () => {
      throw new Error('n/a')
    },
    publishPost: async () => {
      throw new Error('n/a')
    },
    unpublishPost: async () => {
      throw new Error('n/a')
    },
    archivePost: async () => undefined,
    uploadCoverImage: async () => ({ url: 'https://x/y.png', key: 'y' }),
  } as unknown as ContentAdminApi

  const render = (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <ContentProvider adminApi={adminApi}>
        <PostEditor {...props} />
      </ContentProvider>,
    )

  it('padrão: input nativo de agendamento e barra ligada', () => {
    const html = render()
    expect(html).toContain('type="datetime-local"')
    expect(html).toContain('role="toolbar"')
    expect(html).toContain('Nenhum arquivo escolhido')
  })

  it('renderDateTimeInput substitui o input nativo e recebe valor e rótulo', () => {
    const html = render({
      renderDateTimeInput: (props: { id: string; label: string; value: string }) => (
        <span data-testid="custom" id={props.id}>{`custom:${props.label}:${props.value}`}</span>
      ),
    })
    expect(html).not.toContain('datetime-local')
    expect(html).toContain('custom:Agendar para:')
  })

  it('showFormattingToolbar=false esconde a barra e volta à dica de Markdown', () => {
    const html = render({ showFormattingToolbar: false })
    expect(html).not.toContain('role="toolbar"')
    expect(html).toContain('Markdown:')
  })
})
