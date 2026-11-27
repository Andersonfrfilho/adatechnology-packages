/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export const PREVIEW_DEVICES = {
  desktop: { width: 1366 },
  tablet: { width: 768 },
  mobile: { width: 375 },
} as const

export type PreviewDevice = keyof typeof PREVIEW_DEVICES

export const MIN_ZOOM = 50
export const MAX_ZOOM = 150
export const ZOOM_STEP = 10

export type PreviewZoom = number | 'fit'

export type PreviewScaleParams = {
  readonly zoom: PreviewZoom
  readonly device: PreviewDevice
  readonly stageWidth: number
}

/** Escala do iframe: "ajustar" cabe na largura do palco (nunca amplia); número é a porcentagem pedida. */
export function computePreviewScale({ zoom, device, stageWidth }: PreviewScaleParams): number {
  if (zoom !== 'fit') return zoom / 100
  return Math.max(0.1, Math.min(1, stageWidth / PREVIEW_DEVICES[device].width))
}

export function stepPreviewZoom(percent: number, direction: -1 | 1): number {
  const next = Math.round(percent / ZOOM_STEP) * ZOOM_STEP + direction * ZOOM_STEP
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
}
