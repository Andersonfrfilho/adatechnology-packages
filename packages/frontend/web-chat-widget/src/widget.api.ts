/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import { WidgetRequestError, getApiErrorCode, toRetryAfterSeconds } from './widget.error'
import { toTranscript } from './widget.mapper'
import { TRANSCRIPT_LIMIT, WIDGET_PATH } from './widget.constant'
import type {
  PostAudioParams,
  PostMessageParams,
  PostMessageResult,
  SubscribeParams,
  WidgetApiParams,
  WidgetTranscript,
} from './types/widget.types'

/**
 * Sucesso responde `{ data }`; erro responde `{ error: { code, message } }`.
 *
 * O corpo do erro e lido com `catch` proprio porque nem toda falha vem da nossa API: um 502 de proxy
 * chega como HTML, e um `json()` que estoura ali apagaria o status, que e o unico sinal restante.
 */
async function readData(response: Response): Promise<unknown> {
  if (!response.ok) {
    const failure: unknown = await response.json().catch(() => undefined)

    throw new WidgetRequestError({
      status: response.status,
      code: getApiErrorCode(failure),
      retryAfterSeconds: toRetryAfterSeconds(response.headers.get('Retry-After')),
    })
  }

  const body: unknown = await response.json()

  return typeof body === 'object' && body !== null && 'data' in body ? body.data : undefined
}

function toPostMessageResult(data: unknown): PostMessageResult {
  const outcome =
    typeof data === 'object' && data !== null && 'outcome' in data && typeof data.outcome === 'string'
      ? data.outcome
      : ''

  return { outcome }
}

/**
 * Cliente das rotas do widget, amarrado a uma origem so.
 *
 * A origem chega de fora porque muda por ambiente e a rota do servidor confere o `Origin` — dominio
 * chutado no codigo daria erro de CORS silencioso em producao.
 */
export class WidgetApi {
  readonly #baseUrl: string

  constructor({ baseUrl }: WidgetApiParams) {
    this.#baseUrl = baseUrl.replace(/\/+$/, '')
  }

  async createSession(): Promise<string> {
    const response = await fetch(`${this.#baseUrl}${WIDGET_PATH.SESSIONS}`, { method: 'POST' })
    const data = await readData(response)

    if (typeof data !== 'object' || data === null || !('sessionId' in data)) {
      throw new Error('widget session response has no sessionId')
    }
    if (typeof data.sessionId !== 'string') throw new Error('widget sessionId is not a string')

    return data.sessionId
  }

  async postMessage({ sessionId, text }: PostMessageParams): Promise<PostMessageResult> {
    const response = await fetch(`${this.#baseUrl}${WIDGET_PATH.MESSAGES(sessionId)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    return toPostMessageResult(await readData(response))
  }

  /**
   * O audio sobe como arquivo; quem transcreve e a API.
   *
   * Transcricao no navegador seria mandar a chave do provedor para o cliente. Aqui sobe o `Blob` e
   * volta o desfecho do passo do fluxo: o texto reconhecido ja entrou na conversa como fala do
   * visitante, e a tela so precisa recarregar o transcript.
   */
  async postAudio({ sessionId, audio }: PostAudioParams): Promise<PostMessageResult> {
    const form = new FormData()
    form.append('audio', audio, 'audio')

    const response = await fetch(`${this.#baseUrl}${WIDGET_PATH.AUDIO(sessionId)}`, {
      method: 'POST',
      body: form,
    })

    return toPostMessageResult(await readData(response))
  }

  async listMessages(sessionId: string): Promise<WidgetTranscript> {
    const url = `${this.#baseUrl}${WIDGET_PATH.MESSAGES(sessionId)}?limit=${TRANSCRIPT_LIMIT}`
    const response = await fetch(url)

    return toTranscript(await readData(response))
  }

  /**
   * O evento so avisa que mudou; quem le a conversa e a rota do transcript.
   *
   * `EventSource` ja reconecta sozinho, entao nao ha retry aqui — o retorno serve para desligar a
   * assinatura quando o elemento sai do DOM.
   */
  subscribe({ sessionId, onChange }: SubscribeParams): () => void {
    const source = new EventSource(`${this.#baseUrl}${WIDGET_PATH.EVENTS(sessionId)}`)
    source.addEventListener('message', onChange)

    return () => source.close()
  }
}
