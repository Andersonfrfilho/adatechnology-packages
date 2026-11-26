/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export { ImageEditor } from './components/ImageEditor'
export { imageEditorLabelsEn, imageEditorLabelsPtBr } from './labels'
export { buildDefaultPresets } from './presets'
export { focalPointToObjectPosition } from './lib/focalPoint'
export { createInitialState, editReducer, toMetadata } from './lib/editState'
export type {
  Adjustments,
  AspectPreset,
  ImageEditMetadata,
  ImageEditResult,
  ImageEditorLabels,
  ImageEditorProps,
  OutputMimeType,
  Point,
  Rect,
  Rotation,
  Size,
} from './types'
