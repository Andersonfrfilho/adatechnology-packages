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

function asNumberedText(params: BuildFlowChoiceMessageParams): FlowOutboundMessage {
  const lines = params.options.map((option, index) => {
    const description = option.description ? ` — ${option.description}` : ''
    return `${index + 1}. ${option.title}${description}`
  })
  return { kind: 'text', body: `${params.body}\n\n${lines.join('\n')}` }
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
