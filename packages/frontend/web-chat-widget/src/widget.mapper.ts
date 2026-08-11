/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import { DEFAULT_INPUT_HINT, INPUT_HINT_BY_ANSWER_KIND, MESSAGE_DIRECTION, MESSAGE_TYPE } from './widget.constant'
import type { WidgetInputHint, WidgetMessage, WidgetOption, WidgetTranscript } from './types/widget.types'

/**
 * A resposta da rota e entrada nao confiavel, mesmo vindo da nossa API.
 *
 * `payload` chega como `unknown` de proposito: o formato depende do no do fluxo, que e conteudo
 * editado no painel. Guarda de tipo aqui evita que um grafo mal publicado quebre a tela do visitante.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toOption(value: unknown): WidgetOption | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.id !== 'string' || typeof value.title !== 'string') return undefined

  return { id: value.id, title: value.title }
}

function toOptions(payload: unknown): readonly WidgetOption[] {
  if (!isRecord(payload) || !Array.isArray(payload.rows)) return []

  return payload.rows.map(toOption).filter((option): option is WidgetOption => option !== undefined)
}

function toMessage(value: unknown): WidgetMessage | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.id !== 'string' || typeof value.createdAt !== 'string') return undefined

  return {
    id: value.id,
    direction: typeof value.direction === 'string' ? value.direction : MESSAGE_DIRECTION.OUTBOUND,
    sender: typeof value.sender === 'string' ? value.sender : '',
    type: typeof value.type === 'string' ? value.type : MESSAGE_TYPE.TEXT,
    content: typeof value.content === 'string' ? value.content : null,
    options: toOptions(value.payload),
    answerKind: toAnswerKind(value.payload),
    createdAt: value.createdAt,
  }
}

function toAnswerKind(payload: unknown): string {
  if (!isRecord(payload) || typeof payload.answerKind !== 'string') return ''

  return payload.answerKind
}

/**
 * O hint so vale enquanto a pergunta esta de pe.
 *
 * Quem responde ja mudou o campo de assunto; manter `autocomplete="email"` depois da resposta faria
 * o navegador oferecer o e-mail salvo na pergunta seguinte, que pode ser qualquer outra coisa.
 */
function toInputHint(last: WidgetMessage | undefined): WidgetInputHint {
  if (last?.direction !== MESSAGE_DIRECTION.OUTBOUND) return DEFAULT_INPUT_HINT

  return INPUT_HINT_BY_ANSWER_KIND[last.answerKind] ?? DEFAULT_INPUT_HINT
}

/**
 * A rota entrega a janela mais recente ja em ordem cronologica; a tela le de cima para baixo.
 *
 * As opcoes saem da ultima mensagem, e so quando ela e do bot: menu antigo continua no historico,
 * mas clicavel so o do momento — senao o visitante responde uma pergunta que a conversa ja passou.
 */
export function toTranscript(payload: unknown): WidgetTranscript {
  const rows = Array.isArray(payload) ? payload : []
  const messages = rows.map(toMessage).filter((message): message is WidgetMessage => message !== undefined)

  const last = messages.at(-1)
  const options = last?.direction === MESSAGE_DIRECTION.OUTBOUND ? last.options : []

  return { messages, options, inputHint: toInputHint(last) }
}
