/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O vocabulário do núcleo é contrato de host (RNF7): renomear um canal, um status ou um resultado de
 * DKIM quebra quem instalou — o banco dele guarda estas strings. Por isso o teste fixa a lista
 * inteira, na ordem, e não só "contém": acrescentar é versão minor, trocar ou tirar é major.
 *
 * Os nomes vêm do que o produto de origem já grava, não de projeto novo. `webchat` é o único que
 * nasce aqui, porque é o canal que o `conversations-ui` já declara e que o segundo consumidor usa.
 */

import { describe, expect, it } from 'bun:test'

import {
  ATTACHMENT_KIND,
  CONVERSATION_CHANNEL,
  DKIM_RESULT,
  MESSAGE_DELIVERY_STATUS,
  MESSAGE_DIRECTION,
  attachmentKindSchema,
  conversationChannelSchema,
  dkimResultSchema,
  messageDeliveryStatusSchema,
  messageDirectionSchema,
  type AttachmentKind,
  type ConversationChannel,
  type DkimResult,
  type MessageDeliveryStatus,
  type MessageDirection,
} from './vocabulary'

type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

function assertExact<T extends true>(): void {
  void 0 as unknown as T
}

describe('vocabulário do núcleo de conversa', () => {
  it('fixa os canais, na ordem', () => {
    expect([...CONVERSATION_CHANNEL]).toEqual(['email', 'whatsapp', 'app', 'portal', 'webchat'])
    assertExact<Exact<ConversationChannel, 'email' | 'whatsapp' | 'app' | 'portal' | 'webchat'>>()
  })

  it('fixa a direção', () => {
    expect([...MESSAGE_DIRECTION]).toEqual(['inbound', 'outbound'])
    assertExact<Exact<MessageDirection, 'inbound' | 'outbound'>>()
  })

  it('fixa o status de entrega com read e bounced juntos', () => {
    expect([...MESSAGE_DELIVERY_STATUS]).toEqual([
      'queued',
      'sent',
      'delivered',
      'read',
      'failed',
      'bounced',
    ])
    assertExact<
      Exact<MessageDeliveryStatus, 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'bounced'>
    >()
  })

  it('fixa o resultado de DKIM', () => {
    expect([...DKIM_RESULT]).toEqual(['aligned', 'not_aligned', 'unverifiable', 'absent'])
    assertExact<Exact<DkimResult, 'aligned' | 'not_aligned' | 'unverifiable' | 'absent'>>()
  })

  it('fixa o tipo de anexo', () => {
    expect([...ATTACHMENT_KIND]).toEqual(['audio', 'document', 'image'])
    assertExact<Exact<AttachmentKind, 'audio' | 'document' | 'image'>>()
  })

  it('os schemas aceitam exatamente o vocabulário', () => {
    const cases = [
      [conversationChannelSchema, CONVERSATION_CHANNEL, 'messenger'],
      [messageDirectionSchema, MESSAGE_DIRECTION, 'internal'],
      [messageDeliveryStatusSchema, MESSAGE_DELIVERY_STATUS, 'received'],
      [dkimResultSchema, DKIM_RESULT, 'pass'],
      [attachmentKindSchema, ATTACHMENT_KIND, 'video'],
    ] as const

    for (const [schema, accepted, foreign] of cases) {
      for (const value of accepted) expect(schema.safeParse(value).success).toBe(true)
      expect(schema.safeParse(foreign).success).toBe(false)
      expect(schema.safeParse(accepted[0].toUpperCase()).success).toBe(false)
    }
  })

  it('as listas não se alteram em runtime', () => {
    expect(Object.isFrozen(CONVERSATION_CHANNEL)).toBe(true)
    expect(Object.isFrozen(MESSAGE_DIRECTION)).toBe(true)
    expect(Object.isFrozen(MESSAGE_DELIVERY_STATUS)).toBe(true)
    expect(Object.isFrozen(DKIM_RESULT)).toBe(true)
    expect(Object.isFrozen(ATTACHMENT_KIND)).toBe(true)
  })
})
