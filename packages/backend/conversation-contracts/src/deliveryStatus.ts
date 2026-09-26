/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RF3, D6: o status da mensagem enviada só avança. Porta de `message-status.policy.ts` (183):
 * mesma ladder por canal, mesma janela de falha e o mesmo tratamento de evento atrasado — o status
 * não retrocede, mas o horário que faltava entra. A diferença para a origem: o que cada canal
 * **alcança** vem de `getChannelCapabilities` (T105), a mesma fonte que a tela usa — nunca uma
 * segunda lista que pudesse divergir dela.
 *
 * A idempotência por `(canal, id do provedor)` (D6) é do banco (T202, `unique` da 183): esta função
 * é pura e não conhece o id do provedor. Quem chama decide se o evento chegou de novo antes de
 * repassar; aqui só se decide se o status, dado o evento aceito, muda.
 */
import { getChannelCapabilities } from './channelCapabilities'
import type { ConversationChannel, MessageDeliveryStatus } from './vocabulary'

export type DeliveryStatusState = {
  readonly status: MessageDeliveryStatus
  readonly statusTimes: Readonly<Record<string, string>>
}

export type DeliveryStatusEvent = {
  readonly status: MessageDeliveryStatus
  /** Horário ISO da transição, informado por quem chama — a função nunca lê o relógio. */
  readonly at: string
}

export type DeliveryStatusResult =
  | (DeliveryStatusState & { readonly changed: true })
  | (DeliveryStatusState & {
      readonly changed: false
      /** `unsupported`: o canal não alcança esse status; `stale`: chegou tarde; `duplicate`: repetido. */
      readonly reason: 'duplicate' | 'stale' | 'unsupported'
    })

type ChannelLadder = {
  /** Os estados de sucesso, em ordem. */
  readonly ladder: readonly MessageDeliveryStatus[]
  /** Os estados de falha — só alcançáveis antes de o canal confirmar a entrega. */
  readonly failures: readonly MessageDeliveryStatus[]
  /** Até que degrau da escada a falha ainda vale. */
  readonly failableUntil: MessageDeliveryStatus | null
}

const CHANNEL_LADDERS: Readonly<Record<ConversationChannel, ChannelLadder>> = {
  email: { ladder: ['queued', 'sent', 'delivered'], failures: ['failed', 'bounced'], failableUntil: 'sent' },
  whatsapp: {
    ladder: ['queued', 'sent', 'delivered', 'read'],
    failures: ['failed'],
    failableUntil: 'sent',
  },
  app: { ladder: ['queued', 'delivered', 'read'], failures: [], failableUntil: null },
  portal: { ladder: ['delivered', 'read'], failures: [], failableUntil: null },
  webchat: { ladder: ['queued', 'delivered'], failures: ['failed'], failableUntil: 'queued' },
}

function unchanged(current: DeliveryStatusState, reason: 'duplicate' | 'stale' | 'unsupported'): DeliveryStatusResult {
  return { changed: false, reason, status: current.status, statusTimes: current.statusTimes }
}

export function advanceDeliveryStatus(input: {
  readonly channel: ConversationChannel
  readonly current: DeliveryStatusState
  readonly event: DeliveryStatusEvent
}): DeliveryStatusResult {
  const { channel, current, event } = input
  const incoming = event.status

  if (!getChannelCapabilities(channel).reachableStatuses.includes(incoming)) {
    return unchanged(current, 'unsupported')
  }
  if (incoming === current.status) return unchanged(current, 'duplicate')

  const rule = CHANNEL_LADDERS[channel]
  const isFailure = rule.failures.includes(incoming)
  const incomingRank = rule.ladder.indexOf(incoming)
  const currentRank = rule.ladder.indexOf(current.status)
  if (rule.failures.includes(current.status)) return unchanged(current, 'stale')

  const withTime = { ...current.statusTimes, [incoming]: event.at }

  if (isFailure) {
    const limit = rule.failableUntil === null ? -1 : rule.ladder.indexOf(rule.failableUntil)
    if (currentRank > limit) return unchanged(current, 'stale')
    return { changed: true, status: incoming, statusTimes: withTime }
  }
  if (incomingRank > currentRank) {
    return { changed: true, status: incoming, statusTimes: withTime }
  }
  /** Chegou atrasado: o status fica, mas o horário que faltava entra — o selo mostra os horários. */
  if (current.statusTimes[incoming] === undefined) {
    return { changed: true, status: current.status, statusTimes: withTime }
  }
  return unchanged(current, 'stale')
}
