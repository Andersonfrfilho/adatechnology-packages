/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Peças novas da lista do painel (abas, dica, estado, campos injetados) e o rótulo das tags.
 */

import { describe, expect, it } from 'bun:test'
import { buildPostPath, type PublicPostSummary } from '@adatechnology/content-contracts'
import { renderToStaticMarkup } from 'react-dom/server'

import { buildPostMeta } from '../lib/seo'
import { ContentProvider } from '../providers/ContentProvider'
import { DateTimeField } from './DateTimeField'
import { PostCard } from './PostCard'
import { PostListTabs } from './PostListTabs'
import { SelectField } from './SelectField'
import { StatusChip } from './StatusChip'
import { Tooltip } from './Tooltip'

const wrap = (node: React.ReactNode) => renderToStaticMarkup(<ContentProvider>{node}</ContentProvider>)

describe('abas por situação', () => {
  const counts = { published: 12, scheduled: 3, draft: 5, archived: 1, templates: 2 }

  it('quatro abas com ícone, palavra e número; só a ativa é selecionada', () => {
    const html = wrap(<PostListTabs active="scheduled" counts={counts} onChange={() => undefined} />)
    for (const label of ['Publicados', 'Agendados', 'Rascunhos', 'Modelos']) expect(html).toContain(label)
    expect(html).toContain('role="tablist"')
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1)
    expect(html).toMatch(/adc-status-tab__count">12</)
    expect(html).toMatch(/adc-status-tab__count">3</)
    expect(html.match(/<svg/g)?.length).toBe(4)
  })

  it('sem contagem ainda mostra traço, nunca zero falso', () => {
    expect(wrap(<PostListTabs active="published" counts={undefined} onChange={() => undefined} />)).toContain('>–<')
  })
})

describe('estado e dica', () => {
  it('modelo é ícone + palavra + cor própria; status comum segue a semântica', () => {
    const template = wrap(<StatusChip status="draft" isTemplate />)
    expect(template).toContain('Modelo')
    expect(template).toContain('adc-chip--template')
    expect(template).toContain('<svg')
    const published = wrap(<StatusChip status="published" />)
    expect(published).toContain('Publicado')
    expect(published).toContain('adc-chip--published')
  })

  it('a dica liga ao controle por aria-describedby e nunca usa title nativo', () => {
    const html = wrap(
      <Tooltip text="Mantém o mesmo link">
        <button type="button">Republicar</button>
      </Tooltip>,
    )
    const id = /aria-describedby="([^"]+)"/.exec(html)?.[1]
    expect(id).toBeTruthy()
    expect(html).toContain(`role="tooltip" id="${id}"`)
    expect(html).not.toContain(' title=')
  })
})

describe('campos injetados pelo host', () => {
  it('seletor de data e menu do host substituem os nativos', () => {
    const date = wrap(
      <DateTimeField
        id="d"
        label="Data"
        value=""
        onChange={() => undefined}
        renderDateTimeInput={(props) => <div data-host-date={props.id}>{props.label}</div>}
      />,
    )
    expect(date).toContain('data-host-date="d"')
    expect(date).not.toContain('datetime-local')
    const select = wrap(
      <SelectField
        id="s"
        label="Repete"
        value="a"
        options={[{ id: 'a', label: 'A' }]}
        onChange={() => undefined}
        renderSelect={(props) => <div data-host-select={props.id} />}
      />,
    )
    expect(select).toContain('data-host-select="s"')
    expect(select).not.toContain('<select')
  })

  it('sem injeção, o padrão nativo continua funcionando', () => {
    expect(wrap(<DateTimeField id="d" label="Data" value="" onChange={() => undefined} />)).toContain('datetime-local')
    expect(
      wrap(<SelectField id="s" label="X" value="a" options={[{ id: 'a', label: 'A' }]} onChange={() => undefined} />),
    ).toContain('<select')
  })
})

describe('rótulo das tags', () => {
  const post: PublicPostSummary = {
    id: 'p1',
    slug: 'ola',
    shortId: 'abc123',
    title: 'Olá',
    excerpt: null,
    coverImageUrl: null,
    coverImageAlt: null,
    tags: ['fim-de-ano', 'cardapio'],
    tagLabels: { cardapio: 'Cardápio' },
    publishedAt: '2026-11-20T12:00:00.000Z',
    updatedAt: '2026-11-20T12:00:00.000Z',
    authorName: null,
    seoTitle: null,
    seoDescription: null,
    canonicalUrl: null,
    readingTimeMinutes: 1,
  }

  it('usa o rótulo guardado e, sem ele, capitaliza e troca hífen por espaço', () => {
    const html = wrap(<PostCard post={post} href="/x" />)
    expect(html).toContain('Fim de ano')
    expect(html).toContain('Cardápio')
    expect(html).not.toContain('fim-de-ano')
  })
})

describe('endereço canônico no <head>', () => {
  it('a URL passada ao meta é a canônica <base>/<shortId>-<slug>', () => {
    const path = buildPostPath({ basePath: '/novidades', shortId: 'abc123', slug: 'ola' })
    const meta = buildPostMeta(
      {
        id: 'p1',
        slug: 'ola',
        shortId: 'abc123',
        title: 'Olá',
        excerpt: 'r',
        body: 'b',
        coverImageUrl: null,
        coverImageAlt: null,
        tags: [],
        tagLabels: {},
        publishedAt: '2026-11-20T12:00:00.000Z',
        updatedAt: '2026-11-20T12:00:00.000Z',
        authorName: null,
        seoTitle: null,
        seoDescription: null,
        canonicalUrl: null,
        readingTimeMinutes: 1,
      },
      { url: `https://example.com${path}` },
    )
    expect(meta.canonicalUrl).toBe('https://example.com/novidades/abc123-ola')
  })
})
