/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type Size = { readonly width: number; readonly height: number }
export type Point = { readonly x: number; readonly y: number }
export type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

export type Rotation = 0 | 90 | 180 | 270
export type RotationDirection = 'clockwise' | 'counterclockwise'
export type FlipAxis = 'horizontal' | 'vertical'

export type CropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

/** `aspect` é largura / altura; `undefined` é recorte livre. */
export type AspectPreset = { readonly id: string; readonly label: string; readonly aspect: number | undefined }

/** Brilho e contraste vão de -100 a 100; 0 não altera a imagem. */
export type Adjustments = { readonly brightness: number; readonly contrast: number }

/**
 * Estado de edição. `crop` está em pixels da imagem já girada/espelhada, na resolução original.
 * O espelhamento é aplicado antes da rotação.
 */
export type EditState = {
  readonly naturalSize: Size
  readonly rotation: Rotation
  readonly isFlippedHorizontally: boolean
  readonly isFlippedVertically: boolean
  readonly crop: Rect
  readonly presetId: string
  readonly adjustments: Adjustments
  /** Relativo ao resultado recortado (0 a 1). */
  readonly focalPoint: Point
  readonly altText: string
}

/** Tudo o que é preciso para reabrir a edição a partir da imagem original. Valores de posição são relativos (0 a 1). */
export type ImageEditMetadata = {
  readonly version: 1
  readonly sourceSize: Size
  readonly rotation: Rotation
  readonly isFlippedHorizontally: boolean
  readonly isFlippedVertically: boolean
  /** Relativo à imagem girada e espelhada. */
  readonly crop: Rect
  readonly presetId: string
  readonly adjustments: Adjustments
  readonly focalPoint: Point
  readonly altText: string
}

export type ImageEditResult = {
  readonly blob: Blob
  readonly width: number
  readonly height: number
  readonly metadata: ImageEditMetadata
}

export type ImageEditorLabels = {
  readonly title: string
  readonly loading: string
  readonly loadError: string
  readonly stageHelp: string
  readonly toolsAria: string
  readonly tabCrop: string
  readonly tabAdjust: string
  readonly tabFocus: string
  readonly tabText: string
  readonly aspectAria: string
  readonly presetCover: string
  readonly presetGallery: string
  readonly presetSquare: string
  readonly presetFree: string
  readonly rotateLeft: string
  readonly rotateRight: string
  readonly flipHorizontal: string
  readonly flipVertical: string
  readonly zoom: string
  readonly brightness: string
  readonly contrast: string
  readonly focusHint: string
  readonly focusCenter: string
  readonly focusPoint: string
  readonly altLabel: string
  readonly altHint: string
  readonly altPlaceholder: string
  readonly cropFrame: string
  readonly resultSize: string
  readonly cancel: string
  readonly save: string
  readonly saving: string
  readonly reset: string
  readonly revertToOriginal: string
}

export type OutputMimeType = 'image/jpeg' | 'image/webp' | 'image/png'

export type ImageEditorProps = {
  /** O arquivo original, ou o endereço dele (precisa permitir `fetch`). */
  readonly source: Blob | string
  readonly presets?: readonly AspectPreset[] | undefined
  readonly initialPresetId?: string | undefined
  /** Reabre uma edição anterior sobre a mesma imagem original. */
  readonly initialEdit?: ImageEditMetadata | undefined
  readonly labels?: Partial<ImageEditorLabels> | undefined
  readonly outputType?: OutputMimeType | undefined
  readonly outputQuality?: number | undefined
  /** Maior lado do resultado, em pixels. */
  readonly maxOutputSide?: number | undefined
  /** Reduz qualidade e tamanho até o resultado caber neste limite. */
  readonly maxOutputBytes?: number | undefined
  readonly isSaving?: boolean | undefined
  readonly onSave: (result: ImageEditResult) => void
  readonly onCancel: () => void
  /** Quando informado, aparece o botão que descarta a edição e volta à imagem original. */
  readonly onRevertToOriginal?: (() => void) | undefined
}
