/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Embedding de imagem com CLIP em ONNX, no proprio processo. Nao ha servico a subir nem chave a
 * pagar: os pesos sao baixados uma vez e a inferencia roda em CPU.
 */

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
}>

export function createClipEmbedder(
  config: ClipEmbedderConfig = {},
  dependencies: ClipEmbedderDependencies = {},
): ProductVisionEngine {
  const model = config.model ?? CLIP_DEFAULT_MODEL
  const timeoutMs = config.timeoutMs ?? CLIP_DEFAULT_TIMEOUT_MS
  const loadExtractor = dependencies.loadExtractor ?? defaultLoadExtractor

  // Carrega uma vez e reaproveita: instanciar o pipeline por foto releria os pesos do disco a cada
  // mensagem, que e a diferenca entre dezenas de milissegundos e vários segundos por chamada.
  let extractorPromise: Promise<FeatureExtractor> | undefined

  async function read(input: VisionInput): Promise<VisionReading> {
    if (!isSupportedImageMimeType(input.mimeType)) return { engine: ENGINE_NAME }

    extractorPromise ??= loadExtractor(model, config.cacheDir)
    const extractor = await extractorPromise

    const output = await withTimeout(extractor(toDataUrl(input), { pooling: 'mean', normalize: true }), timeoutMs)

    const embedding = Array.from(output.data, Number)
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

function toDataUrl(input: VisionInput): string {
  return `data:${input.mimeType};base64,${input.buffer.toString('base64')}`
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

async function defaultLoadExtractor(model: string, cacheDir?: string): Promise<FeatureExtractor> {
  try {
    const transformers = (await import(/* @vite-ignore */ TRANSFORMERS_PACKAGE)) as unknown as {
      pipeline: (task: string, model: string, options?: unknown) => Promise<FeatureExtractor>
    }
    return await transformers.pipeline(
      'image-feature-extraction',
      model,
      cacheDir ? { cache_dir: cacheDir } : undefined,
    )
  } catch (error) {
    if (error instanceof VisionError) throw error
    throw new VisionEngineUnavailableError(ENGINE_NAME, TRANSFORMERS_PACKAGE, { cause: error })
  }
}
