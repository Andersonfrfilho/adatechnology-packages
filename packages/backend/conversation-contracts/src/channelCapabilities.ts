/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RF2, D3, D4: a capacidade de cada canal, para a tela obedecer — recurso que o canal não tem
 * aparece desabilitado com dica, nunca escondido sem explicação (ADR-0051 §4). Valores herdados de
 * `message-status.policy.ts` e `conversation-attachment.policy.ts` da 183; o racional de cada
 * escolha está em `channelCapabilities.test.ts`.
 */
import type { ConversationChannel, MessageDeliveryStatus } from './vocabulary'

const MB = 1024 * 1024

export type AttachmentCapability = {
  readonly accepted: boolean
  readonly maxBytes: number
  readonly maxTotalBytes: number | null
}

export type AudioCapability = {
  readonly plays: boolean
  readonly records: boolean
}

export type ChannelCapability = {
  readonly confirmsRead: boolean
  readonly sessionWindowHours: number | null
  readonly attachments: AttachmentCapability
  readonly audio: AudioCapability
  readonly quickReplies: boolean
  readonly requiresTransport: boolean
  readonly reachableStatuses: readonly MessageDeliveryStatus[]
}

function freezeCapability(capability: ChannelCapability): ChannelCapability {
  Object.freeze(capability.attachments)
  Object.freeze(capability.audio)
  Object.freeze(capability.reachableStatuses)
  return Object.freeze(capability)
}

export const CHANNEL_CAPABILITIES: Readonly<Record<ConversationChannel, ChannelCapability>> = Object.freeze({
  email: freezeCapability({
    confirmsRead: false,
    sessionWindowHours: null,
    attachments: { accepted: true, maxBytes: 10 * MB, maxTotalBytes: 25 * MB },
    audio: { plays: true, records: true },
    quickReplies: true,
    requiresTransport: true,
    reachableStatuses: ['queued', 'sent', 'delivered', 'failed', 'bounced'],
  }),
  whatsapp: freezeCapability({
    confirmsRead: true,
    sessionWindowHours: 24,
    attachments: { accepted: true, maxBytes: 100 * MB, maxTotalBytes: null },
    audio: { plays: true, records: true },
    quickReplies: true,
    requiresTransport: false,
    reachableStatuses: ['queued', 'sent', 'delivered', 'read', 'failed'],
  }),
  app: freezeCapability({
    confirmsRead: true,
    sessionWindowHours: null,
    attachments: { accepted: true, maxBytes: 25 * MB, maxTotalBytes: null },
    audio: { plays: true, records: true },
    quickReplies: true,
    requiresTransport: false,
    reachableStatuses: ['queued', 'delivered', 'read'],
  }),
  portal: freezeCapability({
    confirmsRead: true,
    sessionWindowHours: null,
    attachments: { accepted: true, maxBytes: 25 * MB, maxTotalBytes: null },
    /** ADR-0073 §2: `Permissions-Policy` nega o microfone no portal — ouve, não grava. */
    audio: { plays: true, records: false },
    quickReplies: true,
    requiresTransport: false,
    reachableStatuses: ['delivered', 'read'],
  }),
  webchat: freezeCapability({
    confirmsRead: false,
    sessionWindowHours: null,
    /** Nasce aqui (sem política de origem): o menor teto de anexo entre os demais canais. */
    attachments: { accepted: true, maxBytes: 10 * MB, maxTotalBytes: null },
    audio: { plays: false, records: false },
    quickReplies: true,
    requiresTransport: false,
    reachableStatuses: ['queued', 'delivered', 'failed'],
  }),
})

export function getChannelCapabilities(channel: ConversationChannel): ChannelCapability {
  return CHANNEL_CAPABILITIES[channel]
}
