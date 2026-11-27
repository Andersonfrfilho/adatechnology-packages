/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import type { Post, PublicPost } from '@adatechnology/content-contracts'

import en from '../locales/en.json'
import ptBR from '../locales/pt-BR.json'
import { interpolate } from '../locales'
import { formatPostDate, fromDateTimeLocalValue, toDateTimeLocalValue } from './format'
import { buildPageItems } from './pagination'
import {
  deriveSlug,
  draftFromPost,
  draftToInput,
  EMPTY_POST_DRAFT,
  isDraftDirty,
  splitTagInput,
  validateDraft,
} from './postDraft'
import { buildPostMeta } from './seo'
import { buildShareLinks } from './share'

const post: Post = {
  id: 'p1',
  companyId: 'c1',
  slug: 'ola',
  shortId: 'abc123',
  tagLabels: {},
  isTemplate: false,
  title: 'Olá',
  excerpt: null,
  body: '# Oi\n\nTexto do post.',
  coverImageUrl: 'https://cdn.example.com/a.png',
  coverImageAlt: null,
  tags: ['dicas'],
  status: 'published',
  publishedAt: '2026-11-20T12:00:00.000Z',
  authorName: null,
  seoTitle: null,
  seoDescription: null,
  canonicalUrl: null,
  readingTimeMinutes: 1,
  createdAt: '2026-11-20T11:00:00.000Z',
  updatedAt: '2026-11-20T12:00:00.000Z',
}

describe('compartilhar', () => {
  it('monta URLs simples das redes, com a URL codificada', () => {
    const links = buildShareLinks({ url: 'https://example.com/blog/a?x=1&y=2', title: 'Título & cia' })
    const byNetwork = Object.fromEntries(links.map((link) => [link.network, link.href]))
    expect(byNetwork.whatsapp).toBe(
      `https://wa.me/?text=${encodeURIComponent('Título & cia https://example.com/blog/a?x=1&y=2')}`,
    )
    expect(byNetwork.facebook).toBe(
      'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fexample.com%2Fblog%2Fa%3Fx%3D1%26y%3D2',
    )
    expect(byNetwork.x).toContain('https://x.com/intent/post?url=https%3A%2F%2Fexample.com')
    expect(byNetwork.x).toContain('&text=T%C3%ADtulo%20%26%20cia')
    expect(byNetwork.linkedin).toBe(
      'https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fexample.com%2Fblog%2Fa%3Fx%3D1%26y%3D2',
    )
  })
})

describe('paginação', () => {
  it('janela curta com reticências', () => {
    expect(buildPageItems({ current: 5, total: 10 }).map((item) => (item.kind === 'page' ? item.page : '…'))).toEqual([
      1,
      '…',
      4,
      5,
      6,
      '…',
      10,
    ])
    expect(buildPageItems({ current: 1, total: 3 }).map((item) => (item.kind === 'page' ? item.page : '…'))).toEqual([
      1, 2, 3,
    ])
    expect(buildPageItems({ current: 9, total: 0 })).toEqual([{ kind: 'page', page: 1 }])
  })
})

describe('rascunho do editor', () => {
  it('ida e volta post → rascunho → entrada, com vazio virando null', () => {
    const draft = draftFromPost(post)
    expect(draft.excerpt).toBe('')
    const input = draftToInput({ ...draft, excerpt: '  ' })
    expect(input.excerpt).toBeNull()
    expect(input.slug).toBe('ola')
    expect(draftToInput({ ...draft, slug: '' })).not.toHaveProperty('slug')
  })

  it('detecta alteração', () => {
    const draft = draftFromPost(post)
    expect(isDraftDirty(draft, draftFromPost(post))).toBe(false)
    expect(isDraftDirty({ ...draft, tags: ['outra'] }, draft)).toBe(true)
  })

  it('slug acompanha o título até o autor mexer nele', () => {
    expect(deriveSlug({ title: 'Promoção de Verão', slug: '', slugTouched: false })).toBe('promocao-de-verao')
    expect(deriveSlug({ title: 'Promoção de Verão', slug: 'meu', slugTouched: true })).toBe('meu')
  })

  it('valida com o schema do servidor', () => {
    expect(validateDraft(EMPTY_POST_DRAFT)).toEqual({ title: true })
    expect(
      validateDraft({
        ...EMPTY_POST_DRAFT,
        title: 'a',
        slug: 'Com Espaço',
        coverImageUrl: 'javascript:x',
        canonicalUrl: 'nada',
      }),
    ).toEqual({ slug: true, coverImageUrl: true, canonicalUrl: true })
    expect(validateDraft({ ...EMPTY_POST_DRAFT, title: 'ok' })).toEqual({})
  })

  it('separa tags por vírgula e normaliza', () => {
    expect(splitTagInput(' Dicas, Eventos  Locais ,,')).toEqual(['dicas', 'eventos locais'])
  })
})

describe('datas', () => {
  it('datetime-local ida e volta no fuso local', () => {
    const local = toDateTimeLocalValue('2026-11-20T12:34:00.000Z')
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(fromDateTimeLocalValue(local)).toBe('2026-11-20T12:34:00.000Z')
    expect(fromDateTimeLocalValue('')).toBeUndefined()
  })

  it('data inválida fica vazia', () => {
    expect(formatPostDate('nada', 'pt-BR')).toBe('')
    expect(formatPostDate(null, 'pt-BR')).toBe('')
    expect(formatPostDate('2026-11-20T12:00:00.000Z', 'pt-BR')).toContain('2026')
  })
})

describe('SEO', () => {
  it('usa campos de SEO quando existem e cai no conteúdo quando não', () => {
    const publicPost: PublicPost = {
      id: post.id,
      slug: post.slug,
      shortId: post.shortId,
      tagLabels: post.tagLabels,
      title: post.title,
      excerpt: post.excerpt,
      body: post.body,
      coverImageUrl: post.coverImageUrl,
      coverImageAlt: post.coverImageAlt,
      tags: post.tags,
      publishedAt: post.publishedAt as string,
      updatedAt: post.updatedAt,
      authorName: post.authorName,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      canonicalUrl: post.canonicalUrl,
      readingTimeMinutes: post.readingTimeMinutes,
    }
    const meta = buildPostMeta(publicPost, { url: 'https://example.com/blog/ola', siteName: 'Loja' })
    expect(meta.title).toBe('Olá | Loja')
    expect(meta.description).toBe('Oi Texto do post.')
    expect(meta.canonicalUrl).toBe('https://example.com/blog/ola')
    expect(meta.openGraph.image).toBe('https://cdn.example.com/a.png')

    const custom = buildPostMeta({ ...publicPost, seoTitle: 'SEO', canonicalUrl: 'https://outro.com/a' }, { url: 'x' })
    expect(custom.title).toBe('SEO')
    expect(custom.canonicalUrl).toBe('https://outro.com/a')
  })
})

describe('locales', () => {
  it('pt-BR e en têm as mesmas chaves', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ptBR).sort())
  })

  it('interpola e mantém chave ausente visível', () => {
    expect(interpolate('{minutes} min', { minutes: 3 })).toBe('3 min')
    expect(interpolate('{x} e {y}', { x: 1 })).toBe('1 e {y}')
  })
})
