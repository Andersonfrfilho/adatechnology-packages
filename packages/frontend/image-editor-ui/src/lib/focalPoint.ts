/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Point } from '../types'

export const CENTER_FOCAL_POINT: Point = { x: 0.5, y: 0.5 }

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function clampFocalPoint(point: Point): Point {
  return { x: clampUnit(point.x), y: clampUnit(point.y) }
}

/** Valor para `object-position` (CSS) ou `objectPosition` (React): mantém o ponto de foco visível ao cortar a imagem. */
export function focalPointToObjectPosition(point: Point): string {
  const safe = clampFocalPoint(point)
  return `${Math.round(safe.x * 1000) / 10}% ${Math.round(safe.y * 1000) / 10}%`
}

export function rotateFocalPointClockwise(point: Point): Point {
  return { x: 1 - point.y, y: point.x }
}

export function mirrorFocalPoint(params: { readonly point: Point; readonly axis: 'horizontal' | 'vertical' }): Point {
  return params.axis === 'horizontal'
    ? { x: 1 - params.point.x, y: params.point.y }
    : { x: params.point.x, y: 1 - params.point.y }
}
