/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Renderização no servidor: o editor nasce em "abrindo", sem controle nativo nenhum.
 */

import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { imageEditorLabelsEn } from '../labels'

import { ImageEditor } from './ImageEditor'
import { AdjustPanel, CropPanel, TextPanel } from './ToolPanels'
import { Slider } from './Slider'

const NOOP = (): void => undefined
const NO_NATIVE_CONTROLS = /<select|type="range"|type="checkbox"|type="radio"|type="file"|<input/

describe('ImageEditor', () => {
  it('mostra o estado de carregamento em pt-BR por padrão', () => {
    const html = renderToStaticMarkup(<ImageEditor source="/x.jpg" onSave={NOOP} onCancel={NOOP} />)
    expect(html).toContain('Abrindo a foto')
  })
  it('aceita rótulos trocados', () => {
    const html = renderToStaticMarkup(<ImageEditor source="/x.jpg" labels={imageEditorLabelsEn} onSave={NOOP} onCancel={NOOP} />)
    expect(html).toContain('Opening the photo')
  })
})

describe('painéis', () => {
  const labels = imageEditorLabelsEn
  it('o corte usa grupo de rádio com botões, controle deslizante próprio e ferramentas com nome', () => {
    const presets = [{ id: 'cover', label: 'Capa 16:9', aspect: 16 / 9 }, { id: 'free', label: 'Livre', aspect: undefined }]
    const html = renderToStaticMarkup(
      <CropPanel labels={labels} presets={presets} presetId="cover" zoom={1} onSelectPreset={NOOP} onZoom={NOOP} onRotate={NOOP} onFlip={NOOP} />,
    )
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain('aria-checked="true"')
    expect(html).toContain('role="slider"')
    expect(html).toContain('aria-label="Rotate left"')
    expect(html).not.toMatch(NO_NATIVE_CONTROLS)
  })
  it('ajustes têm brilho e contraste como sliders próprios', () => {
    const html = renderToStaticMarkup(<AdjustPanel labels={labels} adjustments={{ brightness: 10, contrast: -5 }} onChange={NOOP} />)
    expect(html.match(/role="slider"/g)?.length).toBe(2)
    expect(html).not.toMatch(NO_NATIVE_CONTROLS)
  })
  it('o texto alternativo é um campo de texto com dica', () => {
    const html = renderToStaticMarkup(<TextPanel labels={labels} altText="Varanda" onChange={NOOP} />)
    expect(html).toContain('Varanda')
    expect(html).toContain('Read by screen readers')
  })
})

describe('Slider', () => {
  it('expõe valor, limites e texto para leitor de tela', () => {
    const html = renderToStaticMarkup(<Slider label="Zoom" value={2} min={1} max={6} step={0.05} valueText="200%" onChange={NOOP} />)
    expect(html).toContain('aria-valuenow="2"')
    expect(html).toContain('aria-valuemin="1"')
    expect(html).toContain('aria-valuetext="200%"')
  })
})
