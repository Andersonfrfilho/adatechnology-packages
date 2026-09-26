/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Desempate por modelo de visao, servido por um Ollama local. E o terceiro degrau da cascata: so
 * roda quando o codigo de barras nao decidiu e o vetor trouxe mais de um candidato plausivel.
 *
 * Fala HTTP com o Ollama e nao carrega runtime de modelo: o servidor e do host, com a RAM e o
 * ciclo de vida dele.
 */

import {
  OLLAMA_DEFAULT_BASE_URL,
  OLLAMA_DEFAULT_KEEP_ALIVE,
  OLLAMA_DEFAULT_MAX_IMAGE_WIDTH,
  OLLAMA_DEFAULT_MODEL,
  OLLAMA_DEFAULT_TIMEOUT_MS,
  isSupportedImageMimeType,
} from '../product-vision.constant'
import { VisionError } from '../product-vision.error'
import type { VisionInput } from '../product-vision.types'

const ENGINE_NAME = 'ollama'

export type OllamaRankerConfig = Readonly<{
  baseUrl?: string
  model?: string
  timeoutMs?: number
  /** Quanto o Ollama segura o modelo na memoria. Modelo frio custa ~4x o tempo de um quente. */
  keepAlive?: string
  /**
   * Encolhe a foto antes de enviar. Sem isto a imagem vai como veio, e uma foto de celular custa
   * ~50% mais tempo de prefill que a mesma cena a 896px — sem nenhum ganho de acerto.
   *
   * Porta e nao implementacao porque o redimensionador e do host (sharp, jimp): o pacote nao
   * carrega decodificador de imagem por ninguem.
   */
  prepareImage?: (input: VisionInput, maxWidth: number) => Promise<VisionInput>
  fetchImplementation?: (url: string, init: RequestInit) => Promise<Response>
}>

export type RankCandidate = Readonly<{ productId: string; name: string }>

export type OllamaRanker = Readonly<{
  name: string
  rank: (params: {
    readonly image: VisionInput
    readonly candidates: readonly RankCandidate[]
  }) => Promise<{ readonly productId?: string; readonly engine: string }>
}>

export function createOllamaRanker(config: OllamaRankerConfig = {}): OllamaRanker {
  const baseUrl = (config.baseUrl ?? OLLAMA_DEFAULT_BASE_URL).replace(/\/+$/, '')
  const model = config.model ?? OLLAMA_DEFAULT_MODEL
  const timeoutMs = config.timeoutMs ?? OLLAMA_DEFAULT_TIMEOUT_MS
  const keepAlive = config.keepAlive ?? OLLAMA_DEFAULT_KEEP_ALIVE
  const fetchImplementation = config.fetchImplementation ?? fetch

  async function rank(params: {
    readonly image: VisionInput
    readonly candidates: readonly RankCandidate[]
  }): Promise<{ readonly productId?: string; readonly engine: string }> {
    const { candidates } = params
    // Um candidato so nao e desempate: gastar uma inferencia para "confirmar" o unico item
    // transformaria o degrau mais caro da cascata no mais frequente.
    const unico = candidates[0]
    if (candidates.length <= 1)
      return unico ? { productId: unico.productId, engine: ENGINE_NAME } : { engine: ENGINE_NAME }
    if (!isSupportedImageMimeType(params.image.mimeType)) return { engine: ENGINE_NAME }

    const image = config.prepareImage
      ? await config.prepareImage(params.image, OLLAMA_DEFAULT_MAX_IMAGE_WIDTH)
      : params.image

    const response = await withTimeout(
      fetchImplementation(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          keep_alive: keepAlive,
          // Temperatura zero: a pergunta tem resposta certa, e criatividade aqui e alucinacao.
          options: { temperature: 0 },
          messages: [
            {
              role: 'user',
              content: buildPrompt(candidates),
              images: [image.buffer.toString('base64')],
            },
          ],
        }),
      }),
      timeoutMs,
    )

    if (!response.ok) {
      throw new VisionError(
        `Ollama respondeu ${response.status} ao desempatar.`,
        ENGINE_NAME,
        // 5xx e queda do servidor e merece nova tentativa; 4xx e modelo ausente ou payload
        // invalido, e repetir nao resolve.
        response.status >= 500,
      )
    }

    const payload = (await response.json()) as { message?: { content?: string } }
    const escolha = parseChoice(payload.message?.content ?? '', candidates.length)

    // Fora da faixa, ou o zero que representa "nenhum destes": os dois viram ausencia de escolha,
    // que o consumidor trata como "nao identifiquei". Chutar o primeiro candidato seria apresentar
    // uma recusa como sugestao.
    if (escolha === undefined) return { engine: ENGINE_NAME }

    const escolhido = candidates[escolha]
    return escolhido ? { productId: escolhido.productId, engine: ENGINE_NAME } : { engine: ENGINE_NAME }
  }

  return Object.freeze({ name: ENGINE_NAME, rank })
}

/**
 * O modelo escolhe um NUMERO, nunca o id do produto.
 *
 * Pedir o UUID convida a alucinacao: o modelo inventa um id parecido, o consumidor nao acha na
 * lista e a escolha se perde. Um numero de 0 a N e verificavel em uma linha.
 */
function buildPrompt(candidates: readonly RankCandidate[]): string {
  const lista = candidates.map((candidate, index) => `${index + 1}. ${candidate.name}`).join('\n')

  return [
    'Olhe a foto do produto e diga qual das opcoes abaixo e o MESMO produto.',
    '',
    lista,
    '',
    `Responda APENAS com o numero da opcao (1 a ${candidates.length}).`,
    'Se nenhuma das opcoes for o produto da foto, responda 0.',
  ].join('\n')
}

/** Devolve o indice do array (0-based), ou `undefined` para "nenhum destes" e para lixo. */
function parseChoice(content: string, total: number): number | undefined {
  // O modelo costuma responder "3", mas tambem "A opcao 3." — o primeiro numero da resposta e a
  // escolha, e exigir resposta limpa desperdicaria acerto.
  const encontrado = content.match(/\d+/)
  if (!encontrado) return undefined

  const numero = Number(encontrado[0])
  if (numero < 1 || numero > total) return undefined

  return numero - 1
}

async function withTimeout(promise: Promise<Response>, timeoutMs: number): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new VisionError(`O desempate passou de ${timeoutMs}ms.`, ENGINE_NAME, true)),
          timeoutMs,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
