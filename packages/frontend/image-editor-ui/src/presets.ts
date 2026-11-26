/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { AspectPreset, ImageEditorLabels } from './types'

export const FREE_PRESET_ID = 'free'

export function buildDefaultPresets(labels: ImageEditorLabels): readonly AspectPreset[] {
  return [
    { id: 'cover', label: labels.presetCover, aspect: 16 / 9 },
    { id: 'gallery', label: labels.presetGallery, aspect: 3 / 2 },
    { id: 'square', label: labels.presetSquare, aspect: 1 },
    { id: FREE_PRESET_ID, label: labels.presetFree, aspect: undefined },
  ]
}
