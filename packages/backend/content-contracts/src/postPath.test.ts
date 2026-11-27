/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { buildPostPath, isCanonicalPostRef, parsePostPath, parsePostRef } from './postPath'
import { buildTagLabels, formatTagLabel } from './tags'
import { buildPostUrl } from './feed'

describe('endereço do post', () => {
  it('monta e lê <base>/<shortId>-<slug>', () => {
    const path = buildPostPath({ basePath: '/novidades/', shortId: 'k3x9ab', slug: 'fim-ano' })
    expect(path).toBe('/novidades/k3x9ab-fim-ano')
    expect(parsePostPath({ path: `${path}?x=1#a`, basePath: '/novidades' })).toEqual({
      shortId: 'k3x9ab',
      slug: 'k3x9ab-fim-ano',
    })
  })

  it('slug antigo sem id curto vira só slug; fora da base ou com subcaminho é indefinido', () => {
    expect(parsePostRef('fim-de-ano')).toEqual({ slug: 'fim-de-ano' })
    expect(parsePostPath({ path: '/outro/x', basePath: '/novidades' })).toBeUndefined()
    expect(parsePostPath({ path: '/novidades/a/b', basePath: '/novidades' })).toBeUndefined()
    expect(parsePostPath({ path: '/novidades/%E0%A4%A', basePath: '/novidades' })).toBeUndefined()
  })

  it('só o endereço canônico é canônico (caixa não importa)', () => {
    const post = { shortId: 'k3x9ab', slug: 'novo-titulo' }
    expect(isCanonicalPostRef({ ref: 'K3X9AB-novo-titulo', ...post })).toBe(true)
    expect(isCanonicalPostRef({ ref: 'k3x9ab-titulo-velho', ...post })).toBe(false)
    expect(isCanonicalPostRef({ ref: 'novo-titulo', ...post })).toBe(false)
  })

  it('feed e sitemap aceitam {shortId} no modelo', () => {
    expect(
      buildPostUrl({
        siteUrl: 'https://x.com/',
        slug: 'a-b',
        shortId: 'k3x9ab',
        postPathTemplate: '/novidades/{shortId}-{slug}',
      }),
    ).toBe('https://x.com/novidades/k3x9ab-a-b')
  })
})

describe('rótulos de tag', () => {
  it('guarda como o autor digitou quando difere do slug', () => {
    expect(buildTagLabels({ typed: ['Cardápio', 'festas', 'Fim de Ano'] })).toEqual({
      cardápio: 'Cardápio',
      'fim de ano': 'Fim de Ano',
    })
  })

  it('rótulo explícito vence; anterior sobrevive quando só se digita o slug', () => {
    expect(buildTagLabels({ typed: ['cardapio'], explicit: { cardapio: 'Cardápio' } })).toEqual({
      cardapio: 'Cardápio',
    })
    expect(buildTagLabels({ typed: ['cardapio'], previous: { cardapio: 'Cardápio' } })).toEqual({
      cardapio: 'Cardápio',
    })
  })

  it('rótulo padrão: capitaliza e troca hífen por espaço; o guardado vence', () => {
    expect(formatTagLabel('fim-de-ano')).toBe('Fim de ano')
    expect(formatTagLabel('cardapio', { cardapio: 'Cardápio' })).toBe('Cardápio')
  })
})
