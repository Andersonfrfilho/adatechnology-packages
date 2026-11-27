/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Geometria do recorte em pixels da imagem já girada. Funções puras, sem DOM.
 */

import type { CropHandle, Point, Rect, Rotation, Size } from '../types'

export const MIN_CROP_SIDE = 24
export const MAX_ZOOM = 6

const HANDLE_DIRECTION: Readonly<Record<CropHandle, { readonly sx: -1 | 0 | 1; readonly sy: -1 | 0 | 1 }>> = {
  nw: { sx: -1, sy: -1 },
  n: { sx: 0, sy: -1 },
  ne: { sx: 1, sy: -1 },
  e: { sx: 1, sy: 0 },
  se: { sx: 1, sy: 1 },
  s: { sx: 0, sy: 1 },
  sw: { sx: -1, sy: 1 },
  w: { sx: -1, sy: 0 },
}

export function clamp(params: { readonly value: number; readonly min: number; readonly max: number }): number {
  return Math.min(params.max, Math.max(params.min, params.value))
}

export function orientedSize(params: { readonly size: Size; readonly rotation: Rotation }): Size {
  const isSideways = params.rotation === 90 || params.rotation === 270
  return isSideways ? { width: params.size.height, height: params.size.width } : params.size
}

export function largestSize(params: { readonly bounds: Size; readonly aspect: number }): Size {
  const width = Math.min(params.bounds.width, params.bounds.height * params.aspect)
  return { width, height: width / params.aspect }
}

export function fullRect(bounds: Size): Rect {
  return { x: 0, y: 0, width: bounds.width, height: bounds.height }
}

export function centerOf(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

export function clampRect(params: { readonly rect: Rect; readonly bounds: Size }): Rect {
  const width = Math.min(params.rect.width, params.bounds.width)
  const height = Math.min(params.rect.height, params.bounds.height)
  return {
    width,
    height,
    x: clamp({ value: params.rect.x, min: 0, max: params.bounds.width - width }),
    y: clamp({ value: params.rect.y, min: 0, max: params.bounds.height - height }),
  }
}

export function moveRect(params: { readonly rect: Rect; readonly delta: Point; readonly bounds: Size }): Rect {
  const { rect, delta } = params
  return clampRect({ rect: { ...rect, x: rect.x + delta.x, y: rect.y + delta.y }, bounds: params.bounds })
}

/** 1 é o maior recorte possível na proporção; valores maiores aproximam. */
export function zoomOf(params: { readonly rect: Rect; readonly bounds: Size; readonly aspect?: number }): number {
  const aspect = params.aspect ?? params.rect.width / params.rect.height
  return largestSize({ bounds: params.bounds, aspect }).width / params.rect.width
}

export function applyZoom(params: {
  readonly rect: Rect
  readonly zoom: number
  readonly bounds: Size
  readonly aspect?: number
}): Rect {
  const aspect = params.aspect ?? params.rect.width / params.rect.height
  const base = largestSize({ bounds: params.bounds, aspect })
  const minWidth = Math.max(MIN_CROP_SIDE, MIN_CROP_SIDE * aspect)
  const width = clamp({
    value: base.width / clamp({ value: params.zoom, min: 1, max: MAX_ZOOM }),
    min: Math.min(minWidth, base.width),
    max: base.width,
  })
  const center = centerOf(params.rect)
  const next = { x: center.x - width / 2, y: center.y - width / aspect / 2, width, height: width / aspect }
  return clampRect({ rect: next, bounds: params.bounds })
}

/** Troca a proporção mantendo o centro e o nível de zoom. */
export function fitAspect(params: { readonly rect: Rect; readonly aspect: number; readonly bounds: Size }): Rect {
  const zoom = zoomOf({ rect: params.rect, bounds: params.bounds })
  return applyZoom({ rect: params.rect, zoom, bounds: params.bounds, aspect: params.aspect })
}

export function initialCrop(params: { readonly bounds: Size; readonly aspect: number | undefined }): Rect {
  if (params.aspect === undefined) return fullRect(params.bounds)
  const size = largestSize({ bounds: params.bounds, aspect: params.aspect })
  return { x: (params.bounds.width - size.width) / 2, y: (params.bounds.height - size.height) / 2, ...size }
}

type ResizeParams = {
  readonly rect: Rect
  readonly handle: CropHandle
  readonly pointer: Point
  readonly bounds: Size
  readonly aspect: number | undefined
}

/** Arrasta uma alça; o lado oposto fica parado. Com proporção fixa só as quinas redimensionam. */
export function resizeRect(params: ResizeParams): Rect {
  const { rect, handle, pointer, bounds, aspect } = params
  const { sx, sy } = HANDLE_DIRECTION[handle]
  const right = rect.x + rect.width
  const bottom = rect.y + rect.height
  const availableX = sx > 0 ? bounds.width - rect.x : right
  const availableY = sy > 0 ? bounds.height - rect.y : bottom
  const wantedWidth = sx > 0 ? pointer.x - rect.x : right - pointer.x
  const wantedHeight = sy > 0 ? pointer.y - rect.y : bottom - pointer.y
  const sizeOf = (wanted: number, available: number): number =>
    clamp({ value: wanted, min: Math.min(MIN_CROP_SIDE, available), max: available })
  let width = sx === 0 ? rect.width : sizeOf(wantedWidth, availableX)
  let height = sy === 0 ? rect.height : sizeOf(wantedHeight, availableY)
  if (aspect !== undefined && sx !== 0 && sy !== 0) {
    const maxWidth = Math.min(availableX, availableY * aspect)
    width = clamp({
      value: Math.max(width, height * aspect),
      min: Math.min(Math.max(MIN_CROP_SIDE, MIN_CROP_SIDE * aspect), maxWidth),
      max: maxWidth,
    })
    height = width / aspect
  }
  return { x: sx < 0 ? right - width : rect.x, y: sy < 0 ? bottom - height : rect.y, width, height }
}

/** Gira o retângulo 90° no sentido horário, junto com a imagem. `bounds` é o tamanho antes de girar. */
export function rotateRectClockwise(params: { readonly rect: Rect; readonly bounds: Size }): Rect {
  const { rect, bounds } = params
  return { x: bounds.height - rect.y - rect.height, y: rect.x, width: rect.height, height: rect.width }
}

export function mirrorRect(params: {
  readonly rect: Rect
  readonly bounds: Size
  readonly axis: 'horizontal' | 'vertical'
}): Rect {
  const { rect, bounds } = params
  if (params.axis === 'horizontal') return { ...rect, x: bounds.width - rect.x - rect.width }
  return { ...rect, y: bounds.height - rect.y - rect.height }
}

export function toRelativeRect(params: { readonly rect: Rect; readonly bounds: Size }): Rect {
  const { rect, bounds } = params
  return {
    x: rect.x / bounds.width,
    y: rect.y / bounds.height,
    width: rect.width / bounds.width,
    height: rect.height / bounds.height,
  }
}

export function fromRelativeRect(params: { readonly rect: Rect; readonly bounds: Size }): Rect {
  const { rect, bounds } = params
  return clampRect({
    rect: {
      x: rect.x * bounds.width,
      y: rect.y * bounds.height,
      width: rect.width * bounds.width,
      height: rect.height * bounds.height,
    },
    bounds,
  })
}
