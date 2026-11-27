/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { buildDefaultPresets } from '../presets'
import { imageEditorLabelsPtBr } from '../labels'
import type { EditState } from '../types'

import { boundsOf, createInitialState, editReducer, toMetadata, type EditAction } from './editState'

const PRESETS = buildDefaultPresets(imageEditorLabelsPtBr)
const [COVER, , SQUARE, FREE] = PRESETS as [
  (typeof PRESETS)[number],
  (typeof PRESETS)[number],
  (typeof PRESETS)[number],
  (typeof PRESETS)[number],
]
const NATURAL = { width: 4000, height: 3000 }

function run(state: EditState, action: EditAction): EditState {
  return editReducer({ state, action, presets: PRESETS })
}

describe('editReducer', () => {
  const start = createInitialState({ naturalSize: NATURAL, preset: COVER })

  it('capa 16:9 começa com o maior quadro 16:9', () => {
    expect(start.crop.width / start.crop.height).toBeCloseTo(16 / 9)
    expect(start.presetId).toBe('cover')
  })

  it('girar troca as dimensões e mantém a proporção do preset', () => {
    const rotated = run(start, { type: 'rotate', direction: 'clockwise' })
    expect(rotated.rotation).toBe(90)
    expect(boundsOf(rotated)).toEqual({ width: 3000, height: 4000 })
    expect(rotated.crop.width / rotated.crop.height).toBeCloseTo(16 / 9)
  })

  it('quatro giros voltam a 0 e girar para a esquerda é o inverso', () => {
    let state = start
    for (let turn = 0; turn < 4; turn += 1) state = run(state, { type: 'rotate', direction: 'clockwise' })
    expect(state.rotation).toBe(0)
    expect(
      run(run(start, { type: 'rotate', direction: 'clockwise' }), { type: 'rotate', direction: 'counterclockwise' })
        .rotation,
    ).toBe(0)
    expect(run(start, { type: 'rotate', direction: 'counterclockwise' }).rotation).toBe(270)
  })

  it('espelhar na horizontal de lado altera o eixo guardado vertical', () => {
    const sideways = run(start, { type: 'rotate', direction: 'clockwise' })
    const flipped = run(sideways, { type: 'flip', axis: 'horizontal' })
    expect(flipped.isFlippedVertically).toBe(true)
    expect(flipped.isFlippedHorizontally).toBe(false)
  })

  it('espelhar leva o ponto de foco junto', () => {
    const moved = run(start, { type: 'setFocalPoint', point: { x: 0.2, y: 0.7 } })
    expect(run(moved, { type: 'flip', axis: 'horizontal' }).focalPoint).toEqual({ x: 0.8, y: 0.7 })
  })

  it('quadrado depois de capa mantém o centro e é 1:1', () => {
    const square = run(start, { type: 'selectPreset', preset: SQUARE })
    expect(square.crop.width).toBeCloseTo(square.crop.height)
  })

  it('livre preserva o quadro atual', () => {
    expect(run(start, { type: 'selectPreset', preset: FREE }).crop).toEqual(start.crop)
  })

  it('zoom aproxima e nunca passa da imagem', () => {
    const zoomed = run(start, { type: 'setZoom', zoom: 3 })
    expect(zoomed.crop.width).toBeCloseTo(start.crop.width / 3)
    expect(run(start, { type: 'setZoom', zoom: 0.2 }).crop.width).toBeCloseTo(start.crop.width)
  })

  it('ajustes arredondam e ponto de foco fica entre 0 e 1', () => {
    expect(run(start, { type: 'setAdjustment', key: 'brightness', value: 12.6 }).adjustments.brightness).toBe(13)
    expect(run(start, { type: 'setFocalPoint', point: { x: 4, y: -2 } }).focalPoint).toEqual({ x: 1, y: 0 })
  })

  it('reset volta ao estado inicial', () => {
    expect(run(run(start, { type: 'setAltText', altText: 'x' }), { type: 'reset', initial: start })).toEqual(start)
  })
})

describe('metadados', () => {
  it('reabrir a edição devolve o mesmo estado', () => {
    let state = createInitialState({ naturalSize: NATURAL, preset: COVER })
    state = editReducer({ state, action: { type: 'rotate', direction: 'clockwise' }, presets: PRESETS })
    state = editReducer({ state, action: { type: 'setZoom', zoom: 2 }, presets: PRESETS })
    state = editReducer({ state, action: { type: 'setAltText', altText: 'Varanda' }, presets: PRESETS })
    const metadata = toMetadata(state)
    expect(metadata.crop.width).toBeLessThanOrEqual(1)
    const restored = createInitialState({ naturalSize: NATURAL, preset: COVER, metadata })
    expect(restored.rotation).toBe(90)
    expect(restored.altText).toBe('Varanda')
    expect(restored.crop.width).toBeCloseTo(state.crop.width)
    expect(restored.crop.x).toBeCloseTo(state.crop.x)
  })

  it('metadado de outra imagem é ignorado', () => {
    const metadata = toMetadata(createInitialState({ naturalSize: NATURAL, preset: SQUARE }))
    const other = createInitialState({ naturalSize: { width: 100, height: 100 }, preset: COVER, metadata })
    expect(other.presetId).toBe('cover')
  })
})
