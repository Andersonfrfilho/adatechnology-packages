/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Brilho e contraste valem os mesmos números na prévia (filtro CSS) e na exportação (pixels).
 */

import type { Adjustments } from '../types'

const STRENGTH_DIVISOR = 200
const MIDDLE_GRAY = 127.5

export const NO_ADJUSTMENTS: Adjustments = { brightness: 0, contrast: 0 }

export function adjustmentFactor(value: number): number {
  return 1 + Math.min(100, Math.max(-100, value)) / STRENGTH_DIVISOR
}

export function hasAdjustments(adjustments: Adjustments): boolean {
  return adjustments.brightness !== 0 || adjustments.contrast !== 0
}

export function adjustmentsToCssFilter(adjustments: Adjustments): string {
  if (!hasAdjustments(adjustments)) return 'none'
  return `brightness(${adjustmentFactor(adjustments.brightness)}) contrast(${adjustmentFactor(adjustments.contrast)})`
}

/** Aplica no lugar: primeiro o brilho, depois o contraste em torno do cinza médio; o canal alfa não muda. */
export function applyAdjustmentsToPixels(params: {
  readonly data: Uint8ClampedArray
  readonly adjustments: Adjustments
}): void {
  if (!hasAdjustments(params.adjustments)) return
  const brightness = adjustmentFactor(params.adjustments.brightness)
  const contrast = adjustmentFactor(params.adjustments.contrast)
  const { data } = params
  for (let index = 0; index < data.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = data[index + channel] ?? 0
      data[index + channel] = (value * brightness - MIDDLE_GRAY) * contrast + MIDDLE_GRAY
    }
  }
}
