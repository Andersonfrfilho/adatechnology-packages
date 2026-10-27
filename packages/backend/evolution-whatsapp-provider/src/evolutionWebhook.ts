/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { timingSafeEqual } from 'node:crypto'

import type { EvolutionConnectionState, EvolutionDeliveryStatus } from './types'

/**
 * De que conversa veio a mensagem. Só `user` é uma pessoa com número: grupo, lista de transmissão (os
 * status) e o `@lid` sem número alternativo não têm telefone que case com um cadastro.
 */
export type EvolutionChatKind = 'user' | 'group' | 'broadcast' | 'lid' | 'other'

export type EvolutionWebhookEvent =
  | {
      type: 'message'
      externalMessageId: string
      /** Número de quem escreveu, só dígitos; vazio quando o chat não é `user`. */
      from: string
      fromMe: boolean
      chat: EvolutionChatKind
      text: string | null
      /** O id da mensagem citada (responder a uma mensagem), quando há. */
      replyToExternalMessageId: string | null
      pushName: string | null
      timestamp: number | null
    }
  | { type: 'status'; externalMessageId: string; status: EvolutionDeliveryStatus }
  | { type: 'connection'; state: EvolutionConnectionState }
  | { type: 'ignored'; event: string }

type Json = Record<string, unknown>

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null

const STATUS_MAP: Record<string, EvolutionDeliveryStatus> = {
  SERVER_ACK: 'sent',
  DELIVERY_ACK: 'delivered',
  READ: 'read',
  PLAYED: 'read',
  ERROR: 'failed',
}

/**
 * Compara em tempo constante: o segredo por empresa vai num cabeçalho que o Evolution repete em
 * toda entrega, configurado na criação do webhook da instância.
 */
export function verifyEvolutionWebhookSecret(received: string | null | undefined, expected: string): boolean {
  if (!received || !expected) return false
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function digitsOf(remoteJid: unknown): string {
  return typeof remoteJid === 'string' ? (remoteJid.split('@')[0] ?? '').replace(/\D/g, '') : ''
}

function chatOf(jid: unknown): EvolutionChatKind {
  if (typeof jid !== 'string') return 'other'
  const server = jid.split('@')[1] ?? ''
  if (server === 's.whatsapp.net' || server === 'c.us') return 'user'
  if (server === 'g.us') return 'group'
  if (server === 'broadcast') return 'broadcast'
  if (server === 'lid') return 'lid'
  return 'other'
}

/**
 * O chat de quem escreveu. Com a privacidade `@lid`, o Evolution manda o número de verdade em
 * `remoteJidAlt` (v2.3) ou `senderPn`; sem ele, o chat fica `lid` e sem número.
 */
function senderOf(key: Json): { chat: EvolutionChatKind; from: string } {
  const chat = chatOf(key.remoteJid)
  if (chat !== 'lid') return { chat, from: chat === 'user' ? digitsOf(key.remoteJid) : '' }
  const alternative = [key.remoteJidAlt, key.senderPn].find((jid) => chatOf(jid) === 'user')
  return alternative === undefined ? { chat, from: '' } : { chat: 'user', from: digitsOf(alternative) }
}

const CAPTIONED_MESSAGES = ['imageMessage', 'videoMessage', 'documentMessage', 'documentWithCaptionMessage'] as const

function textOf(message: unknown): string | null {
  if (!isRecord(message)) return null
  if (typeof message.conversation === 'string') return message.conversation
  const extended = message.extendedTextMessage
  if (isRecord(extended) && typeof extended.text === 'string') return extended.text
  for (const kind of CAPTIONED_MESSAGES) {
    const media = message[kind]
    if (isRecord(media) && typeof media.caption === 'string') return media.caption
    /** O documento com legenda vem embrulhado: `documentWithCaptionMessage.message.documentMessage`. */
    if (isRecord(media) && isRecord(media.message)) {
      const inner = textOf(media.message)
      if (inner !== null) return inner
    }
  }
  return null
}

/** O `stanzaId` da mensagem citada, em qualquer tipo de mensagem ou no `contextInfo` de topo (v2). */
function replyToOf(item: Json): string | null {
  const contexts: unknown[] = [item.contextInfo]
  if (isRecord(item.message)) {
    for (const value of Object.values(item.message)) {
      if (isRecord(value)) contexts.push(value.contextInfo)
    }
  }
  for (const context of contexts) {
    if (isRecord(context) && typeof context.stanzaId === 'string' && context.stanzaId !== '') return context.stanzaId
  }
  return null
}

/** O Evolution manda o horário em segundos, como número ou como texto (Long do protobuf). */
function timestampOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return null
}

/** O nome da instância que entregou o evento; quem recebe confere com a instância configurada. */
export function evolutionWebhookInstance(payload: unknown): string | null {
  return isRecord(payload) && typeof payload.instance === 'string' ? payload.instance : null
}

/** Lê o corpo de uma entrega do webhook do Evolution v2 e devolve o evento no vocabulário do canal Meta. */
export function parseEvolutionWebhook(payload: unknown): EvolutionWebhookEvent[] {
  if (!isRecord(payload) || typeof payload.event !== 'string') return [{ type: 'ignored', event: 'invalid' }]
  const event = payload.event.toLowerCase().replace(/_/g, '.')
  const data = payload.data

  if (event === 'connection.update' && isRecord(data)) {
    const state = data.state
    return [{ type: 'connection', state: state === 'open' || state === 'connecting' ? state : 'close' }]
  }

  if (event === 'messages.upsert') {
    const items = Array.isArray(data) ? data : [data]
    return items.flatMap((item): EvolutionWebhookEvent[] => {
      if (!isRecord(item) || !isRecord(item.key) || typeof item.key.id !== 'string') return []
      return [
        {
          type: 'message',
          externalMessageId: item.key.id,
          ...senderOf(item.key),
          fromMe: item.key.fromMe === true,
          text: textOf(item.message),
          replyToExternalMessageId: replyToOf(item),
          pushName: typeof item.pushName === 'string' ? item.pushName : null,
          timestamp: timestampOf(item.messageTimestamp),
        },
      ]
    })
  }

  if (event === 'messages.update') {
    const items = Array.isArray(data) ? data : [data]
    return items.flatMap((item): EvolutionWebhookEvent[] => {
      if (!isRecord(item)) return []
      const id = typeof item.keyId === 'string' ? item.keyId : isRecord(item.key) ? item.key.id : undefined
      const status = typeof item.status === 'string' ? STATUS_MAP[item.status.toUpperCase()] : undefined
      return typeof id === 'string' && status !== undefined ? [{ type: 'status', externalMessageId: id, status }] : []
    })
  }

  return [{ type: 'ignored', event }]
}
