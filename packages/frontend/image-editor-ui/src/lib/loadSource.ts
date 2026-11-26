/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { OutputMimeType, Size } from '../types'

import type { DrawableImage } from './render'

export type LoadedSource = { readonly image: DrawableImage; readonly naturalSize: Size; readonly mimeType: string }

function decodeWithElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const element = new Image()
    element.onload = () => {
      URL.revokeObjectURL(url)
      resolve(element)
    }
    element.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Imagem inválida'))
    }
    element.src = url
  })
}

async function decode(blob: Blob): Promise<DrawableImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' })
    } catch {
      // formatos que o createImageBitmap recusa caem no elemento <img>
    }
  }
  return decodeWithElement(blob)
}

export async function loadSource(source: Blob | string): Promise<LoadedSource> {
  const blob = typeof source === 'string' ? await fetchBlob(source) : source
  const image = await decode(blob)
  return { image, naturalSize: { width: image.width, height: image.height }, mimeType: blob.type }
}

async function fetchBlob(url: string): Promise<Blob> {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error(`Falha ao baixar a imagem (${response.status})`)
  return response.blob()
}

/** JPEG fica JPEG; o resto sai em WebP, que guarda transparência. */
export function defaultOutputType(sourceMimeType: string): OutputMimeType {
  return sourceMimeType === 'image/jpeg' ? 'image/jpeg' : 'image/webp'
}
