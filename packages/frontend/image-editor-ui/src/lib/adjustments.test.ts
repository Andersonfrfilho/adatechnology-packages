/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { adjustmentsToCssFilter, applyAdjustmentsToPixels } from './adjustments'
import { CENTER_FOCAL_POINT, focalPointToObjectPosition } from './focalPoint'

describe('ajustes', () => {
  it('zero não muda nada e o filtro CSS é none', () => {
    const data = new Uint8ClampedArray([10, 120, 250, 255])
    applyAdjustmentsToPixels({ data, adjustments: { brightness: 0, contrast: 0 } })
    expect([...data]).toEqual([10, 120, 250, 255])
    expect(adjustmentsToCssFilter({ brightness: 0, contrast: 0 })).toBe('none')
  })
  it('brilho positivo clareia e o canal alfa fica intacto', () => {
    const data = new Uint8ClampedArray([100, 100, 100, 77])
    applyAdjustmentsToPixels({ data, adjustments: { brightness: 50, contrast: 0 } })
    expect(data[0]).toBeGreaterThan(100)
    expect(data[3]).toBe(77)
  })
  it('contraste afasta os tons do cinza médio', () => {
    const data = new Uint8ClampedArray([200, 50, 128, 255])
    applyAdjustmentsToPixels({ data, adjustments: { brightness: 0, contrast: 100 } })
    expect(data[0]).toBeGreaterThan(200)
    expect(data[1]).toBeLessThan(50)
  })
  it('o filtro CSS usa os mesmos fatores', () => {
    expect(adjustmentsToCssFilter({ brightness: 100, contrast: -100 })).toBe('brightness(1.5) contrast(0.5)')
  })
})

describe('ponto de foco', () => {
  it('vira object-position em porcentagem', () => {
    expect(focalPointToObjectPosition(CENTER_FOCAL_POINT)).toBe('50% 50%')
    expect(focalPointToObjectPosition({ x: 0.123, y: 2 })).toBe('12.3% 100%')
  })
})
