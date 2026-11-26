/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Recorte quadrado central, reduzido ao lado pedido.
 *
 * Foto de perfil é um quadrado: recortar aqui (e não só mostrar o círculo com `object-cover`) faz o
 * arquivo enviado ser exatamente o que a pessoa viu, e mantém o upload pequeno.
 */

const PNG_TYPE = 'image/png'
const JPEG_TYPE = 'image/jpeg'
const JPEG_QUALITY = 0.9

export type SquareCropGeometry = {
  readonly sourceX: number
  readonly sourceY: number
  readonly sourceSide: number
  readonly outputSide: number
}

/** Puro e testável: o canvas só executa o que esta conta decide. Nunca amplia além do original. */
export function computeSquareCrop(params: {
  readonly width: number
  readonly height: number
  readonly maxSide: number
}): SquareCropGeometry {
  const sourceSide = Math.min(params.width, params.height)
  return {
    sourceX: Math.floor((params.width - sourceSide) / 2),
    sourceY: Math.floor((params.height - sourceSide) / 2),
    sourceSide,
    outputSide: Math.min(sourceSide, params.maxSide),
  }
}

/** PNG fica PNG (recorte de fundo é transparente); o resto vira JPEG. */
export async function cropToSquare(file: File, maxSide: number): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const geometry = computeSquareCrop({ width: bitmap.width, height: bitmap.height, maxSide })
  const canvas = document.createElement('canvas')
  canvas.width = geometry.outputSide
  canvas.height = geometry.outputSide
  const context = canvas.getContext('2d')
  if (!context) return file
  context.drawImage(
    bitmap,
    geometry.sourceX,
    geometry.sourceY,
    geometry.sourceSide,
    geometry.sourceSide,
    0,
    0,
    geometry.outputSide,
    geometry.outputSide,
  )
  bitmap.close()
  const outputType = file.type === PNG_TYPE ? PNG_TYPE : JPEG_TYPE
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, JPEG_QUALITY))
  if (!blob) return file
  return new File([blob], file.name, { type: blob.type })
}
