/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Renderização no servidor: a moldura nasce com os três tamanhos, o zoom e o iframe, sem controle nativo.
 */

import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { sitePreviewLabelsEn } from '../labels'

import { SitePreview } from './SitePreview'

describe('SitePreview', () => {
  it('mostra Computador, Tablet e Celular, zoom e o iframe do site', () => {
    const html = renderToStaticMarkup(<SitePreview src="/?preview=1" />)
    expect(html).toContain('Computador')
    expect(html).toContain('Tablet')
    expect(html).toContain('Celular')
    expect(html).toContain('aria-label="Diminuir zoom"')
    expect(html).toContain('aria-label="Aumentar zoom"')
    expect(html).toContain('<iframe')
    expect(html).toContain('src="/?preview=1"')
    expect(html).toContain('spv-sticky')
  })

  it('aceita rótulos trocados e esconde o link quando não há endereço', () => {
    const html = renderToStaticMarkup(<SitePreview src="/" labels={sitePreviewLabelsEn} />)
    expect(html).toContain('Zoom in')
    expect(html).not.toContain('target="_blank"')
  })

  it('mostra Expandir só quando o host controla o layout', () => {
    expect(renderToStaticMarkup(<SitePreview src="/" />)).not.toContain('Expandir')
    expect(renderToStaticMarkup(<SitePreview src="/" onToggleSplit={() => undefined} />)).toContain('Expandir')
  })

  it('sem controle nativo', () => {
    expect(renderToStaticMarkup(<SitePreview src="/" />)).not.toMatch(/<select|type="range"|type="checkbox"|<input/)
  })
})
