/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Estado e transições da edição. Puro: o componente só despacha ações.
 */

import type {
  Adjustments,
  AspectPreset,
  EditState,
  FlipAxis,
  ImageEditMetadata,
  Point,
  Rect,
  RotationDirection,
  Rotation,
  Size,
} from '../types'

import { NO_ADJUSTMENTS } from './adjustments'
import { CENTER_FOCAL_POINT, clampFocalPoint, mirrorFocalPoint, rotateFocalPointClockwise } from './focalPoint'
import {
  applyZoom,
  clampRect,
  fitAspect,
  fromRelativeRect,
  initialCrop,
  mirrorRect,
  orientedSize,
  rotateRectClockwise,
  toRelativeRect,
} from './geometry'

export type EditAction =
  | { readonly type: 'selectPreset'; readonly preset: AspectPreset }
  | { readonly type: 'setCrop'; readonly crop: Rect }
  | { readonly type: 'setZoom'; readonly zoom: number }
  | { readonly type: 'rotate'; readonly direction: RotationDirection }
  | { readonly type: 'flip'; readonly axis: FlipAxis }
  | { readonly type: 'setAdjustment'; readonly key: keyof Adjustments; readonly value: number }
  | { readonly type: 'setFocalPoint'; readonly point: Point }
  | { readonly type: 'setAltText'; readonly altText: string }
  | { readonly type: 'reset'; readonly initial: EditState }

type CreateInitialStateParams = {
  readonly naturalSize: Size
  readonly preset: AspectPreset
  readonly metadata?: ImageEditMetadata
  readonly altText?: string
}

export function createInitialState(params: CreateInitialStateParams): EditState {
  const { naturalSize, preset, metadata } = params
  if (
    metadata &&
    metadata.sourceSize.width === naturalSize.width &&
    metadata.sourceSize.height === naturalSize.height
  ) {
    const bounds = orientedSize({ size: naturalSize, rotation: metadata.rotation })
    return { ...metadata, naturalSize, crop: fromRelativeRect({ rect: metadata.crop, bounds }) }
  }
  return {
    naturalSize,
    rotation: 0,
    isFlippedHorizontally: false,
    isFlippedVertically: false,
    crop: initialCrop({ bounds: naturalSize, aspect: preset.aspect }),
    presetId: preset.id,
    adjustments: NO_ADJUSTMENTS,
    focalPoint: CENTER_FOCAL_POINT,
    altText: params.altText ?? '',
  }
}

export function boundsOf(state: EditState): Size {
  return orientedSize({ size: state.naturalSize, rotation: state.rotation })
}

function nextRotation(params: { readonly rotation: Rotation; readonly direction: RotationDirection }): Rotation {
  const step = params.direction === 'clockwise' ? 90 : 270
  return ((params.rotation + step) % 360) as Rotation
}

function rotate(params: {
  readonly state: EditState
  readonly direction: RotationDirection
  readonly aspect: number | undefined
}): EditState {
  const { state, direction } = params
  const turns = direction === 'clockwise' ? 1 : 3
  let crop = state.crop
  let bounds = boundsOf(state)
  let focalPoint = state.focalPoint
  for (let turn = 0; turn < turns; turn += 1) {
    crop = rotateRectClockwise({ rect: crop, bounds })
    bounds = { width: bounds.height, height: bounds.width }
    focalPoint = rotateFocalPointClockwise(focalPoint)
  }
  if (params.aspect !== undefined) crop = fitAspect({ rect: crop, aspect: params.aspect, bounds })
  return { ...state, rotation: nextRotation({ rotation: state.rotation, direction }), crop, focalPoint }
}

// O espelhamento é guardado antes da rotação: de lado, "horizontal" para quem vê é o eixo vertical da imagem.
function flip(params: { readonly state: EditState; readonly axis: FlipAxis }): EditState {
  const { state, axis } = params
  const isSideways = state.rotation === 90 || state.rotation === 270
  const crop = mirrorRect({ rect: state.crop, bounds: boundsOf(state), axis })
  const focalPoint = mirrorFocalPoint({ point: state.focalPoint, axis })
  const flipsStoredHorizontal = (axis === 'horizontal') !== isSideways
  return flipsStoredHorizontal
    ? { ...state, isFlippedHorizontally: !state.isFlippedHorizontally, crop, focalPoint }
    : { ...state, isFlippedVertically: !state.isFlippedVertically, crop, focalPoint }
}

export function currentAspect(params: {
  readonly state: EditState
  readonly presets: readonly AspectPreset[]
}): number | undefined {
  return params.presets.find((preset) => preset.id === params.state.presetId)?.aspect
}

export function editReducer(params: {
  readonly state: EditState
  readonly action: EditAction
  readonly presets: readonly AspectPreset[]
}): EditState {
  const { state, action } = params
  const aspect = currentAspect({ state, presets: params.presets })
  switch (action.type) {
    case 'selectPreset': {
      const crop =
        action.preset.aspect === undefined
          ? state.crop
          : fitAspect({ rect: state.crop, aspect: action.preset.aspect, bounds: boundsOf(state) })
      return { ...state, presetId: action.preset.id, crop }
    }
    case 'setCrop':
      return { ...state, crop: clampRect({ rect: action.crop, bounds: boundsOf(state) }) }
    case 'setZoom':
      return { ...state, crop: applyZoom({ rect: state.crop, zoom: action.zoom, bounds: boundsOf(state), aspect }) }
    case 'rotate':
      return rotate({ state, direction: action.direction, aspect })
    case 'flip':
      return flip({ state, axis: action.axis })
    case 'setAdjustment':
      return { ...state, adjustments: { ...state.adjustments, [action.key]: Math.round(action.value) } }
    case 'setFocalPoint':
      return { ...state, focalPoint: clampFocalPoint(action.point) }
    case 'setAltText':
      return { ...state, altText: action.altText }
    case 'reset':
      return action.initial
  }
}

export function toMetadata(state: EditState): ImageEditMetadata {
  return {
    version: 1,
    sourceSize: state.naturalSize,
    rotation: state.rotation,
    isFlippedHorizontally: state.isFlippedHorizontally,
    isFlippedVertically: state.isFlippedVertically,
    crop: toRelativeRect({ rect: state.crop, bounds: boundsOf(state) }),
    presetId: state.presetId,
    adjustments: state.adjustments,
    focalPoint: state.focalPoint,
    altText: state.altText,
  }
}
