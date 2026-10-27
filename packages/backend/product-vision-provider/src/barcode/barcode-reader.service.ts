/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Leitor de codigo de barras sobre o zbar compilado em WebAssembly. Roda no processo, sem binario
 * nativo e sem servico: e o degrau mais barato da cascata e o unico com precisao exata — GTIN e
 * chave, nao similaridade.
 */

import { createRequire } from 'node:module'
import { join } from 'node:path'

import {
  BARCODE_DEFAULT_FORMATS,
  BARCODE_DEFAULT_MAX_PIXELS,
  isSupportedImageMimeType,
} from '../product-vision.constant'
import { VisionEngineUnavailableError, VisionError } from '../product-vision.error'
import type { BarcodeReaderConfig, ProductVisionEngine, VisionInput, VisionReading } from '../product-vision.types'

const ENGINE_NAME = 'zbar'
const ZBAR_PACKAGE = '@undecaf/zbar-wasm'

type ZbarSymbol = { readonly typeName: string; decode(): string }
type ZbarModule = { scanImageData(image: ImageData): Promise<readonly ZbarSymbol[]> }

export type BarcodeReaderDependencies = Readonly<{
  /**
   * Injetaveis para o teste rodar sem WASM nem decoder de imagem. Em producao ficam ausentes e o
   * engine carrega o zbar sob demanda.
   */
  loadZbar?: () => Promise<ZbarModule>
  decodeImage?: (input: VisionInput, maxPixels: number) => Promise<ImageData>
}>

export function createBarcodeReader(
  config: BarcodeReaderConfig = {},
  dependencies: BarcodeReaderDependencies = {},
): ProductVisionEngine {
  const formats = new Set(config.formats ?? BARCODE_DEFAULT_FORMATS)
  const maxPixels = config.maxPixels ?? BARCODE_DEFAULT_MAX_PIXELS
  const loadZbar = dependencies.loadZbar ?? defaultLoadZbar
  const decodeImage = dependencies.decodeImage ?? defaultDecodeImage

  async function read(input: VisionInput): Promise<VisionReading> {
    // Mime fora da lista nao e erro do engine: numa cadeia ele so nao contribui, e o proximo
    // engine ainda pode ler a mesma imagem.
    if (!isSupportedImageMimeType(input.mimeType)) return { engine: ENGINE_NAME }

    const zbar = await loadZbar()
    const image = await decodeImage(input, maxPixels)
    const symbols = await zbar.scanImageData(image)

    const match = symbols.find((symbol) => formats.has(symbol.typeName))
    if (!match) return { engine: ENGINE_NAME }

    const barcode = match.decode().trim()
    // Simbolo sem digito nao e GTIN. Deixar passar entregaria lixo para uma busca por chave exata,
    // que responderia "produto nao encontrado" em vez de seguir para o vetor.
    if (!/^\d{8,14}$/.test(barcode)) return { engine: ENGINE_NAME }

    return { barcode, engine: ENGINE_NAME }
  }

  return Object.freeze({ name: ENGINE_NAME, read })
}

async function defaultLoadZbar(): Promise<ZbarModule> {
  try {
    return (await import(/* @vite-ignore */ ZBAR_PACKAGE)) as unknown as ZbarModule
  } catch (primeiroErro) {
    // O import acima resolve a partir DESTE pacote, e um gerenciador que instala por link
    // (pnpm, bun) deixa a peer no consumidor, nao aqui — entao ele falha mesmo com o zbar
    // instalado corretamente. A segunda tentativa parte do processo, que e onde ele esta.
    try {
      const requireFromHost = createRequire(join(process.cwd(), 'noop.js'))
      return requireFromHost(ZBAR_PACKAGE) as ZbarModule
    } catch {
      throw new VisionEngineUnavailableError(ENGINE_NAME, ZBAR_PACKAGE, { cause: primeiroErro })
    }
  }
}

/**
 * O zbar recebe pixels, nao um JPEG. A decodificacao usa a `Image`/`OffscreenCanvas` do runtime
 * quando existem; fora deles o host injeta `decodeImage` com o decoder que tiver (sharp, jimp).
 */
async function defaultDecodeImage(input: VisionInput, maxPixels: number): Promise<ImageData> {
  const globalScope = globalThis as {
    createImageBitmap?: (blob: Blob) => Promise<{ width: number; height: number; close?: () => void }>
    OffscreenCanvas?: new (
      width: number,
      height: number,
    ) => {
      getContext(kind: '2d'): {
        drawImage(image: unknown, x: number, y: number, width: number, height: number): void
        getImageData(x: number, y: number, width: number, height: number): ImageData
      } | null
    }
  }

  if (!globalScope.createImageBitmap || !globalScope.OffscreenCanvas) {
    throw new VisionError(
      'Este runtime nao decodifica imagem sozinho; injete `decodeImage` no createBarcodeReader.',
      ENGINE_NAME,
      false,
    )
  }

  const bitmap = await globalScope.createImageBitmap(new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }))
  const scale = Math.min(1, Math.sqrt(maxPixels / (bitmap.width * bitmap.height)))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const context = new globalScope.OffscreenCanvas(width, height).getContext('2d')
  if (!context) throw new VisionError('Canvas 2D indisponivel para decodificar a imagem.', ENGINE_NAME, false)

  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  return context.getImageData(0, 0, width, height)
}
