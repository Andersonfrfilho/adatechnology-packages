/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import { BUBBLE_GROUP_WINDOW_MS, MESSAGE_DIRECTION } from './widget.constant'
import { buildFormattedFragment } from './widget.markup'
import { buildMascot } from './widget.mascot'
import locale from './widget.locale.json'
import type { WidgetMessage } from './types/widget.types'

const timeFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' })

function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
}

/** "hoje" e "ontem" por dia de calendario, nao por 24 horas: 23h50 e 00h10 sao dias diferentes. */
function formatDay(value: Date): string {
  const days = Math.round((startOfDay(new Date()) - startOfDay(value)) / 86_400_000)

  if (days === 0) return locale.transcript.today
  if (days === 1) return locale.transcript.yesterday

  return dateFormatter.format(value)
}

function buildDivider(value: Date): HTMLElement {
  const divider = document.createElement('p')
  divider.className = 'divider'
  divider.textContent = formatDay(value)

  return divider
}

/**
 * Rabinho e avatar so na primeira bolha do bloco.
 *
 * Repetir o mascote em cada linha de uma resposta de tres mensagens transforma a conversa numa
 * coluna de icones — a mesma razao pela qual todo mensageiro agrupa fala seguida do mesmo lado.
 */
function startsGroup(message: WidgetMessage, previous: WidgetMessage | undefined): boolean {
  if (!previous || previous.direction !== message.direction) return true

  const gap = Date.parse(message.createdAt) - Date.parse(previous.createdAt)

  return !Number.isFinite(gap) || gap > BUBBLE_GROUP_WINDOW_MS
}

function buildMeta(sentAt: Date, isVisitor: boolean): HTMLElement {
  const meta = document.createElement('span')
  meta.className = 'meta'

  const time = document.createElement('span')
  time.textContent = timeFormatter.format(sentAt)
  meta.append(time)

  // Os dois tiques valem o que valem: a mensagem chegou ao servidor. Nao ha leitura de atendente
  // aqui, e inventar um terceiro estado seria mentir para o visitante.
  if (isVisitor) {
    const ticks = document.createElement('span')
    ticks.className = 'ticks'
    ticks.textContent = '✓✓'
    meta.append(ticks)
  }

  return meta
}

function buildRow(message: WidgetMessage, previous: WidgetMessage | undefined): HTMLElement {
  const isVisitor = message.direction === MESSAGE_DIRECTION.INBOUND
  const isFirst = startsGroup(message, previous)
  const sentAt = new Date(message.createdAt)

  const row = document.createElement('div')
  row.className = `row ${isVisitor ? 'row-visitor' : 'row-bot'}`
  row.classList.toggle('row-tail', isFirst)
  row.classList.toggle('row-tight', !isFirst)

  const bubble = document.createElement('div')
  bubble.className = `bubble ${isVisitor ? 'bubble-visitor' : 'bubble-bot'}`
  bubble.append(buildFormattedFragment(message.content ?? ''), buildMeta(sentAt, isVisitor))

  if (!isVisitor) row.append(isFirst ? buildMascot('mascot mascot-bubble') : buildSpacer())
  row.append(bubble)

  return row
}

/** Sem o vao, a bolha sem avatar encosta na borda e o bloco perde o alinhamento com a de cima. */
function buildSpacer(): HTMLElement {
  const spacer = document.createElement('span')
  spacer.className = 'mascot-bubble'

  return spacer
}

export function buildTranscriptNodes(messages: readonly WidgetMessage[]): readonly Node[] {
  const nodes: Node[] = []
  let lastDay = 0

  messages.forEach((message, index) => {
    const sentAt = new Date(message.createdAt)
    const day = startOfDay(sentAt)

    if (Number.isFinite(day) && day !== lastDay) {
      lastDay = day
      nodes.push(buildDivider(sentAt))
    }

    nodes.push(buildRow(message, messages[index - 1]))
  })

  return nodes
}
