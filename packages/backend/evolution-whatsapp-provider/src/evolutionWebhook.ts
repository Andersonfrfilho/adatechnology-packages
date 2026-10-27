/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { timingSafeEqual } from 'node:crypto'

import type { EvolutionConnectionState, EvolutionDeliveryStatus } from './types'

export type EvolutionWebhookEvent =
  | {
      type: 'message'
      externalMessageId: string
      /** Número de quem escreveu, só dígitos. */
      from: string
      fromMe: boolean
      text: string | null
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

function textOf(message: unknown): string | null {
  if (!isRecord(message)) return null
  if (typeof message.conversation === 'string') return message.conversation
  const extended = message.extendedTextMessage
  if (isRecord(extended) && typeof extended.text === 'string') return extended.text
  return null
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
          from: digitsOf(item.key.remoteJid),
          fromMe: item.key.fromMe === true,
          text: textOf(item.message),
          pushName: typeof item.pushName === 'string' ? item.pushName : null,
          timestamp: typeof item.messageTimestamp === 'number' ? item.messageTimestamp : null,
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
