/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import type { WidgetInputHint } from './types/widget.types'

export const WIDGET_TAG_NAME = 'ada-chat-widget'

/** Atributo obrigatorio: a origem da API muda por ambiente e nunca e chutada no codigo. */
export const API_BASE_ATTRIBUTE = 'api-base'

export const WIDGET_PATH = {
  SESSIONS: '/v1/widget/sessions',
  MESSAGES: (sessionId: string): string => `/v1/widget/sessions/${sessionId}/messages`,
  EVENTS: (sessionId: string): string => `/v1/widget/sessions/${sessionId}/events`,
  AUDIO: (sessionId: string): string => `/v1/widget/sessions/${sessionId}/audio`,
} as const

/** Campo de texto comum: sem sugestao do navegador, porque a maioria das perguntas e livre. */
export const DEFAULT_INPUT_HINT: WidgetInputHint = {
  autocomplete: 'off',
  inputMode: 'text',
  type: 'text',
}

/**
 * O que cada tipo de pergunta pede ao navegador.
 *
 * `autocomplete` e o que faz o iOS e o Android oferecerem o dado salvo em um toque; `inputMode`
 * troca o teclado (arroba a vista no e-mail, numerico no telefone). Sao os tres campos que todo
 * lead precisa preencher, e onde a digitacao no celular derruba conversa.
 */
export const INPUT_HINT_BY_ANSWER_KIND: Readonly<Record<string, WidgetInputHint>> = {
  name: { autocomplete: 'name', inputMode: 'text', type: 'text' },
  email: { autocomplete: 'email', inputMode: 'email', type: 'text' },
  phone: { autocomplete: 'tel', inputMode: 'tel', type: 'text' },
  contact: { autocomplete: 'email tel', inputMode: 'email', type: 'text' },
  company: { autocomplete: 'organization', inputMode: 'text', type: 'text' },
  number: { autocomplete: 'off', inputMode: 'numeric', type: 'text' },
} as const

/** Bolhas do mesmo lado dentro desta janela viram um bloco so: um avatar, um rabinho, um horario. */
export const BUBBLE_GROUP_WINDOW_MS = 120_000

/** O que o `MediaRecorder` produz em Chrome e Firefox; o Safari entrega `mp4`, e a API aceita os dois. */
export const AUDIO_MIME_CANDIDATES: readonly string[] = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']

/** Teto do upload de audio: acima disto e mais barato pedir para escrever do que transcrever. */
export const AUDIO_MAX_SECONDS = 120

export type AudioFailureKey = 'audioBusy' | 'audioUnavailable' | 'audioFailed'

/**
 * Codigos de erro da API que o widget precisa distinguir na tela.
 *
 * Declarados aqui, e nao importados: o widget e um Web Component que roda enxertado em site de
 * terceiro e nao pode depender do codigo da API. O acoplamento e o contrato publico da rota — o
 * mesmo que qualquer cliente HTTP teria — e e por isso que o codigo e string estavel, nao enum.
 */
export const AUDIO_ERROR_CODE = {
  BUSY: 'CHANNEL_WIDGET_AUDIO_BUSY',
  UNAVAILABLE: 'CHANNEL_WIDGET_AUDIO_UNAVAILABLE',
  FAILED: 'CHANNEL_WIDGET_AUDIO_FAILED',
  NOT_UNDERSTOOD: 'CHANNEL_WIDGET_AUDIO_NOT_UNDERSTOOD',
  RATE_LIMITED: 'RATE_LIMITED',
} as const

/** A frase sai do codigo, que e a chave estavel do contrato. */
export const AUDIO_STATUS_BY_ERROR_CODE: Readonly<Record<string, AudioFailureKey>> = {
  [AUDIO_ERROR_CODE.BUSY]: 'audioBusy',
  [AUDIO_ERROR_CODE.RATE_LIMITED]: 'audioBusy',
  [AUDIO_ERROR_CODE.UNAVAILABLE]: 'audioUnavailable',
  [AUDIO_ERROR_CODE.FAILED]: 'audioUnavailable',
  [AUDIO_ERROR_CODE.NOT_UNDERSTOOD]: 'audioFailed',
}

/**
 * Rede para quando o codigo nao chega: proxy no meio do caminho, corpo em HTML, rede caindo.
 *
 * Grosso de proposito — o status distingue "espere" de "escreva", que e o minimo para o visitante
 * nao repetir a acao que acabou de falhar.
 */
export const AUDIO_STATUS_BY_HTTP_STATUS: Readonly<Record<number, AudioFailureKey>> = {
  429: 'audioBusy',
  502: 'audioUnavailable',
  503: 'audioUnavailable',
}

/** Quando o servidor nao manda `Retry-After`, "tente de novo" sem numero nao orienta ninguem. */
export const AUDIO_FALLBACK_RETRY_SECONDS = 30

/**
 * A sessao vive na aba, nao no navegador.
 *
 * `sessionStorage` porque o id e uma capacidade: quem o tem le e escreve naquela conversa. Fechou a
 * aba, acabou — e uma maquina compartilhada nao entrega a conversa anterior para o proximo visitante.
 */
export const SESSION_STORAGE_KEY = 'ada:widget:session'

export const MESSAGE_DIRECTION = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
} as const

/** Os dois desfechos em que o bot se cala e quem responde e uma pessoa. */
export const HANDOFF_OUTCOME: readonly string[] = ['handed-off', 'human']

export const MESSAGE_TYPE = {
  TEXT: 'text',
  INTERACTIVE_LIST: 'interactive_list',
} as const

/** A rota devolve as ultimas `limit` mensagens em ordem cronologica — o topo e a mais antiga delas. */
export const TRANSCRIPT_LIMIT = 50

export const MESSAGE_MAX_LENGTH = 1_000

/** Reconexao do SSE: o navegador ja reconecta sozinho, isto cobre a queda do servidor. */
export const SSE_RETRY_MS = 3_000
