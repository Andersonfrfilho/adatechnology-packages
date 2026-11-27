/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { computePreviewScale, MAX_ZOOM, MIN_ZOOM, stepPreviewZoom } from './layout'

describe('layout da prévia', () => {
  it('"ajustar" encolhe para caber no palco e nunca amplia', () => {
    expect(computePreviewScale({ zoom: 'fit', device: 'desktop', stageWidth: 683 })).toBeCloseTo(0.5, 2)
    expect(computePreviewScale({ zoom: 'fit', device: 'mobile', stageWidth: 683 })).toBe(1)
  })

  it('usa a porcentagem pedida', () => {
    expect(computePreviewScale({ zoom: 120, device: 'tablet', stageWidth: 300 })).toBe(1.2)
  })

  it('o zoom anda de 10 em 10 e para nos limites', () => {
    expect(stepPreviewZoom(53, 1)).toBe(60)
    expect(stepPreviewZoom(53, -1)).toBe(MIN_ZOOM)
    expect(stepPreviewZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM)
    expect(stepPreviewZoom(MIN_ZOOM, -1)).toBe(MIN_ZOOM)
  })
})
