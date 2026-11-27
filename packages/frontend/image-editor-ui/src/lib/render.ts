/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Desenho no canvas: o mesmo caminho serve à prévia (escala pequena) e à exportação (escala cheia).
 */

import type { EditState, ImageEditResult, OutputMimeType, Point } from '../types'

import { applyAdjustmentsToPixels, hasAdjustments } from './adjustments'
import { boundsOf, toMetadata } from './editState'

export type DrawableImage = CanvasImageSource & { readonly width: number; readonly height: number }

type DrawParams = {
  readonly context: CanvasRenderingContext2D
  readonly image: DrawableImage
  readonly state: EditState
  readonly scale: number
  /** Canto superior esquerdo, em pixels da imagem girada, que cai no canto do canvas. */
  readonly origin: Point
}

/** Espelha, depois gira em torno do centro, depois desloca para a origem. */
export function drawOriented(params: DrawParams): void {
  const { context, image, state, scale, origin } = params
  const bounds = boundsOf(state)
  context.save()
  context.imageSmoothingQuality = 'high'
  context.translate(-origin.x * scale, -origin.y * scale)
  context.translate((bounds.width * scale) / 2, (bounds.height * scale) / 2)
  context.rotate((state.rotation * Math.PI) / 180)
  context.scale(state.isFlippedHorizontally ? -1 : 1, state.isFlippedVertically ? -1 : 1)
  const width = state.naturalSize.width * scale
  const height = state.naturalSize.height * scale
  context.drawImage(image, -width / 2, -height / 2, width, height)
  context.restore()
}

function createContext(params: { readonly width: number; readonly height: number }): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(params.width))
  canvas.height = Math.max(1, Math.round(params.height))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas 2D indisponível')
  return context
}

function encode(params: {
  readonly canvas: HTMLCanvasElement
  readonly type: OutputMimeType
  readonly quality: number
}): Promise<Blob> {
  return new Promise((resolve, reject) => {
    params.canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível gerar a imagem'))),
      params.type,
      params.quality,
    )
  })
}

export type RenderOptions = {
  readonly outputType: OutputMimeType
  readonly outputQuality: number
  readonly maxOutputSide: number
  readonly maxOutputBytes?: number
}

function renderCanvas(params: {
  readonly image: DrawableImage
  readonly state: EditState
  readonly scale: number
  readonly outputType: OutputMimeType
}): HTMLCanvasElement {
  const { state, scale } = params
  const context = createContext({ width: state.crop.width * scale, height: state.crop.height * scale })
  if (params.outputType === 'image/jpeg') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, context.canvas.width, context.canvas.height)
  }
  drawOriented({ context, image: params.image, state, scale, origin: { x: state.crop.x, y: state.crop.y } })
  if (hasAdjustments(state.adjustments)) {
    const pixels = context.getImageData(0, 0, context.canvas.width, context.canvas.height)
    applyAdjustmentsToPixels({ data: pixels.data, adjustments: state.adjustments })
    context.putImageData(pixels, 0, 0)
  }
  return context.canvas
}

const QUALITY_STEP = 0.1
const MINIMUM_QUALITY = 0.5
const SHRINK_FACTOR = 0.85
const MAXIMUM_SHRINKS = 6

export async function renderEdit(params: {
  readonly image: DrawableImage
  readonly state: EditState
  readonly options: RenderOptions
}): Promise<ImageEditResult> {
  const { image, state, options } = params
  let scale = Math.min(1, options.maxOutputSide / Math.max(state.crop.width, state.crop.height))
  let quality = options.outputQuality
  let shrinks = 0
  for (;;) {
    const canvas = renderCanvas({ image, state, scale, outputType: options.outputType })
    const blob = await encode({ canvas, type: options.outputType, quality })
    const isTooBig = options.maxOutputBytes !== undefined && blob.size > options.maxOutputBytes
    if (!isTooBig || shrinks >= MAXIMUM_SHRINKS)
      return { blob, width: canvas.width, height: canvas.height, metadata: toMetadata(state) }
    if (options.outputType !== 'image/png' && quality - QUALITY_STEP >= MINIMUM_QUALITY) quality -= QUALITY_STEP
    else {
      scale *= SHRINK_FACTOR
      shrinks += 1
    }
  }
}
