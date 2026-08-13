/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Reduz a imagem no navegador quando ela passa do teto aceito pela API.
 *
 * O operador fotografa o produto com o celular, e a foto sai com 8MB e 4000px de lado. Recusar o
 * arquivo é tecnicamente correto e inútil: ele não tem editor de imagem à mão. Então a redução
 * acontece aqui, antes do envio — e o teto do servidor continua de pé como segunda barreira.
 *
 * Imagem que já cabe no teto **não é reprocessada**: recomprimir o que já servia só perderia
 * qualidade sem ganhar byte nenhum.
 */

const MEGABYTE = 1024 * 1024

export const PRODUCT_IMAGE_MAX_BYTES = 5 * MEGABYTE

/**
 * A imagem do produto é renderizada dentro de uma bolha de conversa, nunca em tela cheia. Mais que
 * isso é byte que ninguém vê — e é de onde vem quase toda a redução, sem borrar nada.
 */
const MAX_EDGE_LADDER = [1600, 1024] as const

/** Escada de qualidade: começa alto e só desce quando o arquivo ainda não coube. */
const QUALITY_LADDER = [0.86, 0.74, 0.62, 0.5] as const

/**
 * PNG vira WebP de propósito: PNG é sem perda, então recomprimir PNG grande não resolve, e o
 * WebP preserva a transparência que o JPEG jogaria fora. JPEG segue JPEG — converter ganharia
 * pouco e somaria uma geração de perda.
 */
const ENCODE_TYPE_BY_SOURCE: Readonly<Record<string, string>> = {
  'image/png': 'image/webp',
  'image/webp': 'image/webp',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
}

const EXTENSION_BY_ENCODE_TYPE: Readonly<Record<string, string>> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
}

export function resolveEncodeType(sourceType: string): string | undefined {
  return ENCODE_TYPE_BY_SOURCE[sourceType.toLowerCase()]
}

export type ImageSize = { readonly width: number; readonly height: number }

/** Reduz pelo maior lado, mantendo proporção. Nunca amplia: ampliar inventa pixel e engorda. */
export function resolveTargetSize(source: ImageSize, maxEdge: number): ImageSize {
  const longestEdge = Math.max(source.width, source.height)
  if (longestEdge <= maxEdge) return source

  const ratio = maxEdge / longestEdge

  return {
    width: Math.max(1, Math.round(source.width * ratio)),
    height: Math.max(1, Math.round(source.height * ratio)),
  }
}

export function resolveCompressedName(name: string, encodeType: string): string {
  const extension = EXTENSION_BY_ENCODE_TYPE[encodeType]
  if (!extension) return name

  const base = name.replace(/\.[^./\\]+$/, '')

  return `${base || 'imagem'}.${extension}`
}

export type EncodeAttempt = { readonly maxEdge: number; readonly quality: number }

/** A escada inteira, na ordem em que é tentada — qualidade cai antes de o tamanho cair de novo. */
export function buildEncodeAttempts(): readonly EncodeAttempt[] {
  return MAX_EDGE_LADDER.flatMap((maxEdge) => QUALITY_LADDER.map((quality) => ({ maxEdge, quality })))
}

export type CompressImageParams = {
  readonly file: File
  readonly maxBytes?: number
}

/**
 * Devolve o arquivo original quando ele já cabe, quando o formato não é recomprimível, quando o
 * navegador não expõe canvas, ou quando a recompressão não encolheu nada. Nunca lança: falhar aqui
 * significa seguir com o original, e quem recusa é o servidor.
 */
export async function compressImage({ file, maxBytes = PRODUCT_IMAGE_MAX_BYTES }: CompressImageParams): Promise<File> {
  if (file.size <= maxBytes) return file

  const encodeType = resolveEncodeType(file.type)
  if (!encodeType) return file
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file

  let bitmap: ImageBitmap | undefined

  try {
    bitmap = await createImageBitmap(file)

    for (const attempt of buildEncodeAttempts()) {
      const size = resolveTargetSize({ width: bitmap.width, height: bitmap.height }, attempt.maxEdge)
      const blob = await encodeToBlob({ bitmap, size, encodeType, quality: attempt.quality })

      if (blob && blob.size <= maxBytes && blob.size < file.size) {
        return new File([blob], resolveCompressedName(file.name, encodeType), { type: encodeType })
      }
    }

    return file
  } catch {
    return file
  } finally {
    bitmap?.close()
  }
}

type EncodeToBlobParams = {
  readonly bitmap: ImageBitmap
  readonly size: ImageSize
  readonly encodeType: string
  readonly quality: number
}

async function encodeToBlob({ bitmap, size, encodeType, quality }: EncodeToBlobParams): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height

  const context = canvas.getContext('2d')
  if (!context) return null

  context.drawImage(bitmap, 0, 0, size.width, size.height)

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, encodeType, quality)
  })
}
