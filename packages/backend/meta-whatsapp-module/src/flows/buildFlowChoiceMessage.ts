/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Escolha → mensagem do canal. Botão com até 3 opções simples, lista com descrição/seção ou com 4+,
 * e texto numerado quando nem a lista cabe nos tetos da Meta.
 *
 * O texto numerado é a rede de segurança: passar de um teto faz a Graph API recusar a mensagem
 * inteira e o cliente ver silêncio. Numerado, ele ainda responde "2" e o runner entende.
 */

import {
  WHATSAPP_CHOICE_LIMIT,
  listInteractiveLimitViolations,
  type InteractiveListSection,
  type InteractiveMessage,
} from '@adatechnology/meta-whatsapp-contracts'
import { DEFAULT_FLOW_TEXT } from './flowRunner.constant'

export type FlowChoiceOption = {
  readonly id: string
  readonly title: string
  readonly description?: string
  readonly section?: string
}

export type FlowOutboundMessage =
  | { readonly kind: 'text'; readonly body: string }
  | { readonly kind: 'interactive'; readonly interactive: InteractiveMessage }

export type BuildFlowChoiceMessageParams = {
  readonly body: string
  readonly options: readonly FlowChoiceOption[]
  readonly listButtonLabel: string
}

function groupSections(options: readonly FlowChoiceOption[]): InteractiveListSection[] {
  const sections: { title?: string; rows: FlowChoiceOption[] }[] = []
  for (const option of options) {
    const title = option.section?.trim() || undefined
    const existing = sections.find((section) => section.title === title)
    if (existing) existing.rows.push(option)
    else sections.push({ title, rows: [option] })
  }
  return sections.map((section) => ({
    ...(section.title ? { title: section.title } : {}),
    rows: section.rows.map((row) => ({
      id: row.id,
      title: row.title,
      ...(row.description ? { description: row.description } : {}),
    })),
  }))
}

/**
 * Texto numerado, cortado no teto de mensagem de texto (4096). Linhas que não cabem saem e o texto
 * termina em "…": melhor uma lista incompleta que a Meta recusar a mensagem inteira. Quem precisa de
 * muitas opções usa `dynamic_choice`, que pagina.
 */
function asNumberedText(params: BuildFlowChoiceMessageParams): FlowOutboundMessage {
  const lines = params.options.map((option, index) => {
    const description = option.description ? ` — ${option.description}` : ''
    return `${index + 1}. ${option.title}${description}`
  })
  const limit = WHATSAPP_CHOICE_LIMIT.TEXT_BODY_LENGTH
  const full = `${params.body}\n\n${lines.join('\n')}`
  if (Array.from(full).length <= limit) return { kind: 'text', body: full }

  const truncated = `\n${DEFAULT_FLOW_TEXT.MORE_OPTIONS_TRUNCATED}`
  let body = `${params.body}\n`
  for (const line of lines) {
    const candidate = `${body}\n${line}`
    if (Array.from(candidate).length + truncated.length > limit) break
    body = candidate
  }
  const withMarker = `${body}${truncated}`
  return { kind: 'text', body: Array.from(withMarker).slice(0, limit).join('') }
}

export function buildFlowChoiceMessage(params: BuildFlowChoiceMessageParams): FlowOutboundMessage {
  const isPlain = params.options.every((option) => !option.description && !option.section)
  if (isPlain && params.options.length <= WHATSAPP_CHOICE_LIMIT.BUTTONS) {
    const buttons: InteractiveMessage = {
      kind: 'buttons',
      body: params.body,
      buttons: params.options.map((option) => ({ id: option.id, title: option.title })),
    }
    if (listInteractiveLimitViolations(buttons).length === 0) return { kind: 'interactive', interactive: buttons }
  }

  const list: InteractiveMessage = {
    kind: 'list',
    body: params.body,
    buttonLabel: params.listButtonLabel,
    sections: groupSections(params.options),
  }
  if (listInteractiveLimitViolations(list).length === 0) return { kind: 'interactive', interactive: list }

  return asNumberedText(params)
}
