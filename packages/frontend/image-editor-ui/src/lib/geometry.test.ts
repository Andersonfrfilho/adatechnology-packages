/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import {
  applyZoom,
  fitAspect,
  initialCrop,
  mirrorRect,
  moveRect,
  resizeRect,
  rotateRectClockwise,
  zoomOf,
} from './geometry'

const BOUNDS = { width: 1000, height: 800 }

describe('recorte inicial', () => {
  it('16:9 é o maior quadro centralizado', () => {
    const crop = initialCrop({ bounds: BOUNDS, aspect: 16 / 9 })
    expect(crop.width).toBe(1000)
    expect(crop.height).toBeCloseTo(562.5)
    expect(crop.y).toBeCloseTo(118.75)
  })
  it('livre começa com a imagem inteira', () => {
    expect(initialCrop({ bounds: BOUNDS, aspect: undefined })).toEqual({ x: 0, y: 0, width: 1000, height: 800 })
  })
})

describe('mover e zoom', () => {
  it('não deixa o quadro sair da imagem', () => {
    const rect = { x: 100, y: 100, width: 200, height: 200 }
    expect(moveRect({ rect, delta: { x: -500, y: 9000 }, bounds: BOUNDS })).toEqual({
      x: 0,
      y: 600,
      width: 200,
      height: 200,
    })
  })
  it('zoom 2 reduz o quadro à metade mantendo o centro', () => {
    const rect = initialCrop({ bounds: BOUNDS, aspect: 1 })
    const zoomed = applyZoom({ rect, zoom: 2, bounds: BOUNDS, aspect: 1 })
    expect(zoomed.width).toBe(400)
    expect(zoomed.x + 200).toBeCloseTo(500)
    expect(zoomOf({ rect: zoomed, bounds: BOUNDS, aspect: 1 })).toBeCloseTo(2)
  })
  it('trocar a proporção mantém o zoom', () => {
    const rect = applyZoom({ rect: initialCrop({ bounds: BOUNDS, aspect: 1 }), zoom: 2, bounds: BOUNDS, aspect: 1 })
    const next = fitAspect({ rect, aspect: 16 / 9, bounds: BOUNDS })
    expect(next.width / next.height).toBeCloseTo(16 / 9)
    expect(zoomOf({ rect: next, bounds: BOUNDS, aspect: 16 / 9 })).toBeCloseTo(2)
  })
})

describe('alças', () => {
  const rect = { x: 200, y: 200, width: 300, height: 300 }
  it('livre: a quina sudeste acompanha o ponteiro e o canto noroeste fica parado', () => {
    expect(resizeRect({ rect, handle: 'se', pointer: { x: 600, y: 450 }, bounds: BOUNDS, aspect: undefined })).toEqual({
      x: 200,
      y: 200,
      width: 400,
      height: 250,
    })
  })
  it('livre: alça lateral só muda a largura', () => {
    const next = resizeRect({ rect, handle: 'w', pointer: { x: 100, y: 999 }, bounds: BOUNDS, aspect: undefined })
    expect(next).toEqual({ x: 100, y: 200, width: 400, height: 300 })
  })
  it('proporção fixa mantém a razão e respeita a imagem', () => {
    const next = resizeRect({ rect, handle: 'se', pointer: { x: 5000, y: 5000 }, bounds: BOUNDS, aspect: 1 })
    expect(next.width / next.height).toBeCloseTo(1)
    expect(next.x + next.width).toBeLessThanOrEqual(BOUNDS.width)
    expect(next.y + next.height).toBeLessThanOrEqual(BOUNDS.height)
  })
  it('canto noroeste ancora o sudeste', () => {
    const next = resizeRect({ rect, handle: 'nw', pointer: { x: 100, y: 100 }, bounds: BOUNDS, aspect: undefined })
    expect(next).toEqual({ x: 100, y: 100, width: 400, height: 400 })
  })
  it('não colapsa abaixo do mínimo', () => {
    const next = resizeRect({ rect, handle: 'se', pointer: { x: 0, y: 0 }, bounds: BOUNDS, aspect: undefined })
    expect(next.width).toBeGreaterThan(0)
  })
})

describe('girar e espelhar', () => {
  it('quatro giros devolvem o retângulo', () => {
    let rect = { x: 100, y: 50, width: 300, height: 200 }
    let bounds = BOUNDS
    for (let turn = 0; turn < 4; turn += 1) {
      rect = rotateRectClockwise({ rect, bounds })
      bounds = { width: bounds.height, height: bounds.width }
    }
    expect(rect).toEqual({ x: 100, y: 50, width: 300, height: 200 })
  })
  it('espelhar duas vezes devolve o retângulo', () => {
    const rect = { x: 100, y: 50, width: 300, height: 200 }
    const once = mirrorRect({ rect, bounds: BOUNDS, axis: 'horizontal' })
    expect(once.x).toBe(600)
    expect(mirrorRect({ rect: once, bounds: BOUNDS, axis: 'horizontal' })).toEqual(rect)
  })
})
