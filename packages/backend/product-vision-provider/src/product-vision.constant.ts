/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/**
 * CLIP ViT-B/32: 512 dimensoes, ~90MB em ONNX quantizado. E a dimensao que o
 * `@adatechnology/catalog-module` indexa, e trocar o modelo sem reindexar e recusado no boot de la.
 */
export const CLIP_DEFAULT_MODEL = 'Xenova/clip-vit-base-patch32'
export const CLIP_DEFAULT_DIMENSIONS = 512
export const CLIP_DEFAULT_TIMEOUT_MS = 30_000

/**
 * So os formatos lineares de produto. QR Code fica de fora de proposito: gondola tem QR de
 * promocao colado do lado do preco, e o cliente fotografa a prateleira inteira — decodificar esse
 * QR viraria "codigo do produto" com a confianca de um GTIN.
 *
 * Os nomes sao os que o zbar devolve em `symbol.typeName`, verificados contra a biblioteca real.
 * Nomes "bonitos" como `EAN-13` nao casam com nada, e o efeito e a leitura sempre voltar vazia —
 * sem erro, sem log, so o cliente ouvindo "nao identifiquei" para toda foto.
 */
export const BARCODE_DEFAULT_FORMATS = [
  'ZBAR_EAN13',
  'ZBAR_EAN8',
  'ZBAR_UPCA',
  'ZBAR_UPCE',
  'ZBAR_ISBN13',
  'ZBAR_I25',
  'ZBAR_CODE128',
  'ZBAR_CODE39',
  'ZBAR_DATABAR',
] as const

/** ~2MP: o suficiente para um EAN de embalagem, e o que impede uma foto de 12MP prender o worker. */
export const BARCODE_DEFAULT_MAX_PIXELS = 2_000_000

export const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export function normalizeMimeType(value: string): string {
  return (value.split(';')[0] ?? '').trim().toLowerCase()
}

export function isSupportedImageMimeType(value: string): boolean {
  return (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(normalizeMimeType(value))
}
