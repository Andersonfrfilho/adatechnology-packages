/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * D5, CA03: ligar o canal `email` sem `ConversationEmailTransportPort` é erro na subida, nomeando
 * a peça que falta — "canal que aceita mensagem e perde a resposta é pior que canal desligado"
 * (spec 211, D5). Sem Postgres: a checagem roda antes de qualquer repositório tocar `db`, então um
 * `db` inerte basta.
 */
import { describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'

import type {
  ClockPort,
  ConversationChannelPort,
  ConversationEmailTransportPort,
} from '@adatechnology/conversation-contracts'

import type { ConversationDatabase } from './database.types'
import { createConversationModule } from './ConversationModule'
import { ChannelTransportMissingError } from './errors'

function fixedClock(): ClockPort {
  return { now: () => new Date('2026-09-26T12:00:00.000Z') }
}

function stubChannelPort(): ConversationChannelPort {
  return {
    async sendText() {
      return { providerMessageId: randomUUID() }
    },
    async sendAttachment() {
      return { providerMessageId: randomUUID() }
    },
  }
}

function stubEmailTransport(): ConversationEmailTransportPort {
  return {
    deriveReplyAddress: () => 'reply+token@example.test',
    verifyReplyToken: () => true,
    async sendEmail() {
      return { providerMessageId: randomUUID() }
    },
    async recordRawInboundEmail() {
      return { sha256: 'a'.repeat(64) }
    },
    async verifyDkim() {
      return 'aligned'
    },
  }
}

const inertDb = {} as ConversationDatabase

describe('D5/CA03 — canal email exige transporte na subida', () => {
  test('email em enabledChannels sem emailTransport lança ChannelTransportMissingError', () => {
    expect(() =>
      createConversationModule({
        config: { enabledChannels: ['email'] },
        providers: { db: inertDb, clock: fixedClock(), channels: {} },
      }),
    ).toThrow(ChannelTransportMissingError)
  })

  test('a mensagem nomeia a porta que falta e o canal, sem segredo/endereço/config', () => {
    try {
      createConversationModule({
        config: { enabledChannels: ['email'] },
        providers: { db: inertDb, clock: fixedClock(), channels: {} },
      })
      throw new Error('deveria ter lançado ChannelTransportMissingError')
    } catch (error) {
      expect(error).toBeInstanceOf(ChannelTransportMissingError)
      const transportError = error as ChannelTransportMissingError
      expect(transportError.code).toBe('CONVERSATION_CHANNEL_TRANSPORT_MISSING')
      expect(transportError.channel).toBe('email')
      expect(transportError.message).toContain('email')
      expect(transportError.message).toContain('ConversationEmailTransportPort')
      expect(transportError.message).not.toMatch(/@|https?:\/\/|secret|token|senha/i)
    }
  })

  test('email em enabledChannels com emailTransport sobe, e enabledChannels inclui email', () => {
    const module = createConversationModule({
      config: { enabledChannels: ['email'] },
      providers: { db: inertDb, clock: fixedClock(), channels: {}, emailTransport: stubEmailTransport() },
    })

    expect(module.enabledChannels).toContain('email')
  })

  test('sem email pedido, nenhum transporte é exigido', () => {
    const module = createConversationModule({
      config: { enabledChannels: ['whatsapp'] },
      providers: { db: inertDb, clock: fixedClock(), channels: { whatsapp: stubChannelPort() } },
    })

    expect(module.enabledChannels).toContain('whatsapp')
    expect(module.enabledChannels).not.toContain('email')
  })

  test(
    'a exigência é por capacidade (requiresTransport), não por lista de canais à mão: ' +
      'whatsapp (requiresTransport: false) sobe sem porta de transporte alguma',
    () => {
      expect(() =>
        createConversationModule({
          config: { enabledChannels: ['whatsapp'] },
          providers: { db: inertDb, clock: fixedClock(), channels: {} },
        }),
      ).not.toThrow()
    },
  )

  test('sem enabledChannels nenhum, nada é exigido (compatibilidade com T206)', () => {
    expect(() =>
      createConversationModule({
        providers: { db: inertDb, clock: fixedClock(), channels: {} },
      }),
    ).not.toThrow()
  })
})
