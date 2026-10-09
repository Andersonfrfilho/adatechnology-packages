/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A visão do participante (spec 260, contract §2): os tipos que a API devolve ao app. A resposta é
 * entrada não confiável, então cada tipo tem schema zod e o teste fixa o que é recusado, não só o que
 * passa. `subjectType` é par opaco: o núcleo nunca conhece o nome do assunto do produto.
 */

import { describe, expect, it } from 'bun:test'

import {
  PARTICIPANT_CONVERSATION_STATUS,
  SUBJECT_TYPE_PATTERN,
  participantAttachmentSchema,
  participantConversationPageSchema,
  participantConversationStatusSchema,
  participantConversationSummarySchema,
  participantMessageSchema,
  subjectRefSchema,
  type ParticipantAttachment,
  type ParticipantConversationPage,
  type ParticipantConversationStatus,
  type ParticipantConversationSummary,
  type ParticipantMessage,
  type ParticipantSubjectRef,
} from './participant'

type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

function assertExact<T extends true>(): void {
  void 0 as unknown as T
}

const VALID_SUMMARY = {
  subjectType: 'trip',
  subjectId: 'viagem-42',
  subjectLabel: 'Viagem 42',
  lastMessageAt: '2026-10-08T12:00:00Z',
  lastMessagePreview: 'Chegamos no galpão',
  lastMessageDirection: 'inbound',
  unreadCount: 2,
  awaitingParticipant: true,
  status: 'open',
  attributes: { tripId: 'trip-42' },
} as const

const VALID_MESSAGE = {
  id: 'msg-1',
  clientMessageId: 'client-1',
  direction: 'outbound',
  authorName: null,
  text: 'Ok, aguardo',
  attachments: [],
  createdAt: '2026-10-08T12:01:00Z',
  status: 'delivered',
  readAt: null,
} as const

const VALID_ATTACHMENT = {
  id: 'att-1',
  kind: 'image',
  filename: 'canhoto.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 1024,
} as const

describe('padrão de subjectType (opaco, sem vocabulário de produto)', () => {
  it('aceita minúsculas, dígitos, hífen e sublinhado, começando por letra', () => {
    expect(SUBJECT_TYPE_PATTERN.test('trip')).toBe(true)
    expect(SUBJECT_TYPE_PATTERN.test('a')).toBe(true)
    expect(SUBJECT_TYPE_PATTERN.test('tipo_2-x')).toBe(true)
  })

  it('aceita exatamente 64 caracteres e recusa 65', () => {
    expect(SUBJECT_TYPE_PATTERN.test('a' + 'b'.repeat(63))).toBe(true)
    expect(SUBJECT_TYPE_PATTERN.test('a' + 'b'.repeat(64))).toBe(false)
  })

  it('recusa maiúscula, vazio, espaço e começo por dígito', () => {
    expect(SUBJECT_TYPE_PATTERN.test('Trip')).toBe(false)
    expect(SUBJECT_TYPE_PATTERN.test('')).toBe(false)
    expect(SUBJECT_TYPE_PATTERN.test('tipo com espaco')).toBe(false)
    expect(SUBJECT_TYPE_PATTERN.test('9trip')).toBe(false)
  })
})

describe('subjectRefSchema', () => {
  it('aceita o par válido', () => {
    const parsed: ParticipantSubjectRef = subjectRefSchema.parse({ subjectType: 'trip', subjectId: 'x' })
    expect(parsed.subjectId).toBe('x')
  })

  it('recusa subjectId vazio e com 129 caracteres, e aceita 128', () => {
    expect(subjectRefSchema.safeParse({ subjectType: 'trip', subjectId: '' }).success).toBe(false)
    expect(subjectRefSchema.safeParse({ subjectType: 'trip', subjectId: 'x'.repeat(129) }).success).toBe(false)
    expect(subjectRefSchema.safeParse({ subjectType: 'trip', subjectId: 'x'.repeat(128) }).success).toBe(true)
  })

  it('recusa subjectType fora do padrão', () => {
    expect(subjectRefSchema.safeParse({ subjectType: 'Trip', subjectId: 'x' }).success).toBe(false)
  })
})

describe('status da conversa do participante', () => {
  it('fixa open e closed, na ordem', () => {
    expect([...PARTICIPANT_CONVERSATION_STATUS]).toEqual(['open', 'closed'])
    assertExact<Exact<ParticipantConversationStatus, 'open' | 'closed'>>()
  })

  it('recusa status fora do vocabulário', () => {
    expect(participantConversationStatusSchema.safeParse('archived').success).toBe(false)
  })
})

describe('participantConversationSummarySchema', () => {
  it('aceita o resumo válido', () => {
    const parsed: ParticipantConversationSummary = participantConversationSummarySchema.parse(VALID_SUMMARY)
    expect(parsed.unreadCount).toBe(2)
  })

  it('aceita lastMessageAt null (conversa sem mensagem)', () => {
    const result = participantConversationSummarySchema.safeParse({ ...VALID_SUMMARY, lastMessageAt: null })
    expect(result.success).toBe(true)
    assertExact<Exact<ParticipantConversationSummary['lastMessageAt'], string | null>>()
  })

  it('aceita sem os campos opcionais', () => {
    const { lastMessagePreview, lastMessageDirection, attributes, ...required } = VALID_SUMMARY
    void lastMessagePreview
    void lastMessageDirection
    void attributes
    expect(participantConversationSummarySchema.safeParse(required).success).toBe(true)
  })

  it('recusa status fora de open/closed', () => {
    expect(participantConversationSummarySchema.safeParse({ ...VALID_SUMMARY, status: 'archived' }).success).toBe(
      false,
    )
  })

  it('recusa unreadCount negativo', () => {
    expect(participantConversationSummarySchema.safeParse({ ...VALID_SUMMARY, unreadCount: -1 }).success).toBe(false)
  })

  it('recusa direção fora do vocabulário', () => {
    expect(
      participantConversationSummarySchema.safeParse({ ...VALID_SUMMARY, lastMessageDirection: 'internal' }).success,
    ).toBe(false)
  })
})

describe('participantConversationPageSchema', () => {
  it('aceita página sem nextCursor (última página)', () => {
    const parsed: ParticipantConversationPage = participantConversationPageSchema.parse({
      data: [VALID_SUMMARY],
    })
    expect(parsed.nextCursor).toBeUndefined()
  })

  it('aceita página com nextCursor', () => {
    const result = participantConversationPageSchema.safeParse({ data: [], nextCursor: 'cursor-2' })
    expect(result.success).toBe(true)
  })
})

describe('participantAttachmentSchema', () => {
  it('aceita o anexo válido e recusa tipo fora do vocabulário de anexo', () => {
    const parsed: ParticipantAttachment = participantAttachmentSchema.parse(VALID_ATTACHMENT)
    expect(parsed.sizeBytes).toBe(1024)
    expect(participantAttachmentSchema.safeParse({ ...VALID_ATTACHMENT, kind: 'video' }).success).toBe(false)
  })

  it('recusa tamanho negativo', () => {
    expect(participantAttachmentSchema.safeParse({ ...VALID_ATTACHMENT, sizeBytes: -1 }).success).toBe(false)
  })
})

describe('participantMessageSchema', () => {
  it('aceita a mensagem válida', () => {
    const parsed: ParticipantMessage = participantMessageSchema.parse(VALID_MESSAGE)
    expect(parsed.direction).toBe('outbound')
    assertExact<Exact<ParticipantMessage['direction'], 'inbound' | 'outbound'>>()
  })

  it('recusa direção fora do vocabulário', () => {
    expect(participantMessageSchema.safeParse({ ...VALID_MESSAGE, direction: 'internal' }).success).toBe(false)
  })

  it('aceita sem os campos opcionais e com readAt null', () => {
    const minimal = {
      id: 'msg-2',
      direction: 'inbound',
      attachments: [VALID_ATTACHMENT],
      createdAt: '2026-10-08T12:02:00Z',
      readAt: null,
    }
    expect(participantMessageSchema.safeParse(minimal).success).toBe(true)
  })

  it('recusa status de entrega fora do vocabulário', () => {
    expect(participantMessageSchema.safeParse({ ...VALID_MESSAGE, status: 'received' }).success).toBe(false)
  })
})
