/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Embedding de imagem com CLIP em ONNX, no proprio processo. Nao ha servico a subir nem chave a
 * pagar: os pesos sao baixados uma vez e a inferencia roda em CPU.
 */

import { createRequire } from 'node:module'
import { join } from 'node:path'

import { CLIP_DEFAULT_DIMENSIONS, CLIP_DEFAULT_MODEL, CLIP_DEFAULT_TIMEOUT_MS } from '../product-vision.constant'
import { isSupportedImageMimeType } from '../product-vision.constant'
import { VisionEngineUnavailableError, VisionError } from '../product-vision.error'
import type { ClipEmbedderConfig, ProductVisionEngine, VisionInput, VisionReading } from '../product-vision.types'

const ENGINE_NAME = 'clip'
const TRANSFORMERS_PACKAGE = '@huggingface/transformers'

type FeatureExtractor = (input: unknown, options?: unknown) => Promise<{ data: ArrayLike<number> }>

export type ClipEmbedderDependencies = Readonly<{
  /** Injetavel para o teste rodar sem baixar 90MB de pesos. */
  loadExtractor?: (model: string, cacheDir?: string) => Promise<FeatureExtractor>
  /**
   * Converte os bytes na imagem que o extractor entende. O default usa o `RawImage` do
   * transformers.js, que decodifica em memoria.
   *
   * Nao e data URL: o transformers TENTA BUSCAR a URL que recebe, entao uma `data:` volta como
   * "404 Not Found" — sintoma que nao lembra em nada a causa.
   */
  toImage?: (input: VisionInput) => Promise<unknown>
}>

export function createClipEmbedder(
  config: ClipEmbedderConfig = {},
  dependencies: ClipEmbedderDependencies = {},
): ProductVisionEngine {
  const model = config.model ?? CLIP_DEFAULT_MODEL
  const timeoutMs = config.timeoutMs ?? CLIP_DEFAULT_TIMEOUT_MS
  const loadExtractor = dependencies.loadExtractor ?? defaultLoadExtractor
  const toImage = dependencies.toImage ?? defaultToImage

  // Carrega uma vez e reaproveita: instanciar o pipeline por foto releria os pesos do disco a cada
  // mensagem, que e a diferenca entre dezenas de milissegundos e vários segundos por chamada.
  let extractorPromise: Promise<FeatureExtractor> | undefined

  async function read(input: VisionInput): Promise<VisionReading> {
    if (!isSupportedImageMimeType(input.mimeType)) return { engine: ENGINE_NAME }

    extractorPromise ??= loadExtractor(model, config.cacheDir)
    const extractor = await extractorPromise

    // Sem `{ pooling, normalize }`: medido contra a biblioteca, `image-feature-extraction` ignora
    // as duas opcoes — o vetor sai identico com e sem elas. Passa-las sugeria uma garantia que
    // nao existia, e a normalizacao abaixo e o que de fato a cumpre.
    const output = await withTimeout(
      toImage(input).then((image) => extractor(image)),
      timeoutMs,
    )

    const embedding = normalize(Array.from(output.data, Number))
    // Vetor de tamanho inesperado envenenaria o indice do consumidor em silencio — la a coluna tem
    // dimensao fixa, e um vetor curto seria recusado so no INSERT, no meio de uma conversa.
    if (embedding.length !== CLIP_DEFAULT_DIMENSIONS) {
      throw new VisionError(
        `O modelo "${model}" devolveu vetor de ${embedding.length} dimensoes; o esperado e ${CLIP_DEFAULT_DIMENSIONS}.`,
        ENGINE_NAME,
        false,
      )
    }

    return { embedding, engine: ENGINE_NAME }
  }

  return Object.freeze({
    name: ENGINE_NAME,
    embeddingModel: { id: model, dimensions: CLIP_DEFAULT_DIMENSIONS },
    read,
  })
}

/**
 * Vetor unitario. O CLIP entrega norma ~11, e o indice do consumidor compara por cosseno — que
 * normaliza sozinho, entao a busca funcionaria de qualquer forma.
 *
 * Normalizar mesmo assim porque a garantia passa a valer para quem comparar por distancia
 * euclidiana ou produto interno, e porque um vetor de norma arbitraria no indice e uma armadilha
 * silenciosa para o proximo que escolher outro operador.
 */
function normalize(values: readonly number[]): number[] {
  const norma = Math.sqrt(values.reduce((soma, valor) => soma + valor * valor, 0))
  return norma === 0 ? [...values] : values.map((valor) => valor / norma)
}

async function defaultToImage(input: VisionInput): Promise<unknown> {
  const transformers = await loadTransformers()
  return transformers.RawImage.fromBlob(new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }))
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new VisionError(`A inferencia passou de ${timeoutMs}ms.`, ENGINE_NAME, true)),
          timeoutMs,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

type TransformersModule = {
  pipeline: (task: string, model: string, options?: unknown) => Promise<FeatureExtractor>
  RawImage: { fromBlob: (blob: Blob) => Promise<unknown> }
}

async function loadTransformers(): Promise<TransformersModule> {
  try {
    return (await import(/* @vite-ignore */ TRANSFORMERS_PACKAGE)) as unknown as TransformersModule
  } catch (primeiroErro) {
    // O import resolve a partir DESTE pacote, e gerenciador que instala por link (pnpm, bun)
    // deixa a peer no consumidor. A segunda tentativa parte do processo, que e onde ela esta.
    try {
      const requireFromHost = createRequire(join(process.cwd(), 'noop.js'))
      return requireFromHost(TRANSFORMERS_PACKAGE) as TransformersModule
    } catch {
      throw new VisionEngineUnavailableError(ENGINE_NAME, TRANSFORMERS_PACKAGE, { cause: primeiroErro })
    }
  }
}

async function defaultLoadExtractor(model: string, cacheDir?: string): Promise<FeatureExtractor> {
  const transformers = await loadTransformers()
  return transformers.pipeline('image-feature-extraction', model, cacheDir ? { cache_dir: cacheDir } : undefined)
}
