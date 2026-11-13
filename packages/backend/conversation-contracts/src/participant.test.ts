/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A visão do participante (spec 260, contract §2): os tipos que a API devolve ao app. A resposta é
 * entrada não confiável, então cada tipo tem schema zod e o teste fixa o que é recusado, não só o que
 * passa. `subjectType` é par opaco: o núcleo nunca conhece o nome do assunto do produto.
 */

import { describe, expect, it } from 'bun:test'

import type { ConversationChannel } from './vocabulary'
import {
  PARTICIPANT_AUDIO_DURATION_MAX_MS,
  PARTICIPANT_CONVERSATION_STATUS,
  PARTICIPANT_TRANSCRIPTION_STATUS,
  PARTICIPANT_TRANSCRIPTION_TEXT_MAX_UTF16,
  SUBJECT_TYPE_PATTERN,
  participantAttachmentSchema,
  participantConversationPageSchema,
  participantConversationStatusSchema,
  participantConversationSummarySchema,
  participantMessageSchema,
  participantTranscriptionSchema,
  subjectRefSchema,
  type ParticipantAttachment,
  type ParticipantConversationPage,
  type ParticipantConversationStatus,
  type ParticipantConversationSummary,
  PARTICIPANT_ORIGINAL_TEXT_MAX_UTF16,
  type ParticipantMessage,
  type ParticipantSubjectRef,
  type ParticipantTranscription,
  type ParticipantTranscriptionStatus,
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

describe('protocol do resumo da conversa', () => {
  const parse = (protocol: unknown) =>
    participantConversationSummarySchema.safeParse({ ...VALID_SUMMARY, protocol }).success

  it('aceita um protocolo legível', () => {
    expect(parse('261009-K7M2')).toBe(true)
    assertExact<Exact<ParticipantConversationSummary['protocol'], string | undefined>>()
  })

  it('aceita o resumo sem protocolo', () => {
    expect(participantConversationSummarySchema.safeParse(VALID_SUMMARY).success).toBe(true)
  })

  it('recusa protocolo vazio, com espaço ou fora do padrão', () => {
    expect(parse('')).toBe(false)
    expect(parse('2610 09')).toBe(false)
    expect(parse('261009_K7M2')).toBe(false)
    expect(parse('protocolo!')).toBe(false)
  })

  it('limita o protocolo a 32 caracteres', () => {
    expect(parse('A'.repeat(32))).toBe(true)
    expect(parse('A'.repeat(33))).toBe(false)
  })
})

describe('channels e iconName do resumo da conversa', () => {
  const parseWith = (extra: Record<string, unknown>) =>
    participantConversationSummarySchema.safeParse({ ...VALID_SUMMARY, ...extra }).success

  it('aceita canais do vocabulário e ausente ou vazio', () => {
    expect(parseWith({ channels: ['app', 'whatsapp'] })).toBe(true)
    expect(parseWith({ channels: [] })).toBe(true)
    expect(participantConversationSummarySchema.safeParse(VALID_SUMMARY).success).toBe(true)
    assertExact<Exact<ParticipantConversationSummary['channels'], ConversationChannel[] | undefined>>()
  })

  it('recusa canal fora do vocabulário, duplicata e mais de 5 itens', () => {
    expect(parseWith({ channels: ['sms'] })).toBe(false)
    expect(parseWith({ channels: ['app', 'app'] })).toBe(false)
    expect(parseWith({ channels: ['app', 'whatsapp', 'email', 'portal', 'webchat'] })).toBe(true)
    expect(parseWith({ channels: ['app', 'whatsapp', 'email', 'portal', 'webchat', 'app'] })).toBe(false)
  })

  it('aceita iconName em minúsculas e recusa maiúscula, espaço, vazio e 33 caracteres', () => {
    expect(parseWith({ iconName: 'file-text' })).toBe(true)
    expect(parseWith({ iconName: 'a'.repeat(32) })).toBe(true)
    expect(parseWith({ iconName: 'FileText' })).toBe(false)
    expect(parseWith({ iconName: 'file text' })).toBe(false)
    expect(parseWith({ iconName: '' })).toBe(false)
    expect(parseWith({ iconName: 'a'.repeat(33) })).toBe(false)
    assertExact<Exact<ParticipantConversationSummary['iconName'], string | undefined>>()
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
    expect(participantConversationSummarySchema.safeParse({ ...VALID_SUMMARY, status: 'archived' }).success).toBe(false)
  })

  it('recusa unreadCount negativo', () => {
    expect(participantConversationSummarySchema.safeParse({ ...VALID_SUMMARY, unreadCount: -1 }).success).toBe(false)
  })

  it('aceita o texto original até o limite e recusa acima dele', () => {
    const atLimit = 'a'.repeat(PARTICIPANT_ORIGINAL_TEXT_MAX_UTF16)
    expect(participantMessageSchema.parse({ ...VALID_MESSAGE, originalText: atLimit }).originalText).toBe(atLimit)
    expect(participantMessageSchema.safeParse({ ...VALID_MESSAGE, originalText: null }).success).toBe(true)
    expect(participantMessageSchema.safeParse({ ...VALID_MESSAGE, originalText: `${atLimit}a` }).success).toBe(false)
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

const READY_TRANSCRIPTION = {
  status: 'ready',
  text: 'Chegamos no galpão',
  language: 'pt',
  engine: 'whisper-local',
  generatedAt: '2026-10-08T12:03:00Z',
} as const

describe('participantTranscriptionSchema — estados', () => {
  it('aceita os quatro estados', () => {
    expect(participantTranscriptionSchema.safeParse({ status: 'pending' }).success).toBe(true)
    expect(participantTranscriptionSchema.safeParse(READY_TRANSCRIPTION).success).toBe(true)
    expect(participantTranscriptionSchema.safeParse({ status: 'failed' }).success).toBe(true)
    expect(participantTranscriptionSchema.safeParse({ status: 'disabled' }).success).toBe(true)
  })

  it('fixa os status na ordem e o tipo inferido', () => {
    expect([...PARTICIPANT_TRANSCRIPTION_STATUS]).toEqual(['pending', 'ready', 'failed', 'disabled'])
    assertExact<Exact<ParticipantTranscriptionStatus, 'pending' | 'ready' | 'failed' | 'disabled'>>()
    const parsed: ParticipantTranscription = participantTranscriptionSchema.parse(READY_TRANSCRIPTION)
    expect(parsed.status).toBe('ready')
  })

  it('aceita ready com texto vazio, que é silêncio e não falha', () => {
    expect(participantTranscriptionSchema.safeParse({ ...READY_TRANSCRIPTION, text: '' }).success).toBe(true)
  })

  it('recusa status fora do vocabulário', () => {
    expect(participantTranscriptionSchema.safeParse({ status: 'queued' }).success).toBe(false)
  })

  it('exige text e generatedAt em ready', () => {
    const { text, ...withoutText } = READY_TRANSCRIPTION
    const { generatedAt, ...withoutGeneratedAt } = READY_TRANSCRIPTION
    void text
    void generatedAt
    expect(participantTranscriptionSchema.safeParse(withoutText).success).toBe(false)
    expect(participantTranscriptionSchema.safeParse(withoutGeneratedAt).success).toBe(false)
  })
})

describe('participantTranscriptionSchema — campos fora do ramo são descartados', () => {
  it('descarta text em pending: aceito, mas ausente do resultado', () => {
    const parsed = participantTranscriptionSchema.parse({ status: 'pending', text: 'vazou' })
    expect(parsed).toEqual({ status: 'pending' })
    expect('text' in parsed).toBe(false)
  })

  it('descarta campo desconhecido em qualquer ramo', () => {
    expect(participantTranscriptionSchema.parse({ status: 'disabled', engine: 'x', extra: 1 })).toEqual({
      status: 'disabled',
    })
    expect(participantTranscriptionSchema.parse({ status: 'failed', text: 'x' })).toEqual({ status: 'failed' })
  })
})

describe('participantTranscriptionSchema — failed', () => {
  it('aceita too_long com teto, sem teto e teto sem motivo', () => {
    expect(
      participantTranscriptionSchema.safeParse({ status: 'failed', reason: 'too_long', maxDurationMs: 300_000 })
        .success,
    ).toBe(true)
    expect(participantTranscriptionSchema.safeParse({ status: 'failed', reason: 'too_long' }).success).toBe(true)
    expect(participantTranscriptionSchema.safeParse({ status: 'failed', maxDurationMs: 300_000 }).success).toBe(true)
  })

  it('recusa motivo fora de too_long e teto que não é inteiro positivo', () => {
    expect(participantTranscriptionSchema.safeParse({ status: 'failed', reason: 'timeout' }).success).toBe(false)
    expect(participantTranscriptionSchema.safeParse({ status: 'failed', maxDurationMs: 0 }).success).toBe(false)
    expect(participantTranscriptionSchema.safeParse({ status: 'failed', maxDurationMs: 1.5 }).success).toBe(false)
  })
})

describe('participantTranscriptionSchema — campos do ramo ready', () => {
  const parseWith = (extra: Record<string, unknown>) =>
    participantTranscriptionSchema.safeParse({ ...READY_TRANSCRIPTION, ...extra }).success

  it('aceita idioma de duas ou três letras minúsculas', () => {
    expect(parseWith({ language: 'pt' })).toBe(true)
    expect(parseWith({ language: 'por' })).toBe(true)
  })

  it('recusa idioma nulo, maiúsculo, regional ou vazio', () => {
    expect(parseWith({ language: null })).toBe(false)
    expect(parseWith({ language: 'PT' })).toBe(false)
    expect(parseWith({ language: 'pt-BR' })).toBe(false)
    expect(parseWith({ language: '' })).toBe(false)
  })

  it('aceita generatedAt em UTC e recusa sem fuso', () => {
    expect(parseWith({ generatedAt: '2026-10-08T12:03:00Z' })).toBe(true)
    expect(parseWith({ generatedAt: '2026-10-08T12:03:00' })).toBe(false)
  })

  it('recusa generatedAt com offset, porque o contrato usa z.string().datetime() sem offset', () => {
    expect(parseWith({ generatedAt: '2026-10-08T09:03:00-03:00' })).toBe(false)
  })

  it('aceita engine ausente e recusa engine vazio', () => {
    const { engine, ...withoutEngine } = READY_TRANSCRIPTION
    void engine
    expect(participantTranscriptionSchema.safeParse(withoutEngine).success).toBe(true)
    expect(parseWith({ engine: '' })).toBe(false)
  })
})

describe('participantTranscriptionSchema — teto do texto em unidades UTF-16', () => {
  const parseText = (text: string) => participantTranscriptionSchema.safeParse({ ...READY_TRANSCRIPTION, text }).success

  it('fixa o teto em 40 000 unidades UTF-16', () => {
    expect(PARTICIPANT_TRANSCRIPTION_TEXT_MAX_UTF16).toBe(40_000)
  })

  it('aceita texto com emoji até 40 000 unidades UTF-16 e recusa uma a mais', () => {
    const atLimit = '😀'.repeat(20_000)
    expect(atLimit.length).toBe(40_000)
    expect(parseText(atLimit)).toBe(true)
    expect(parseText(atLimit + 'a')).toBe(false)
  })
})

describe('durationMs e transcription no anexo', () => {
  const AUDIO_ATTACHMENT = {
    ...VALID_ATTACHMENT,
    kind: 'audio',
    filename: 'audio.webm',
    mimeType: 'audio/webm',
  } as const

  it('aceita duração inteira positiva até o teto e recusa fora dele', () => {
    const parseDuration = (durationMs: unknown) =>
      participantAttachmentSchema.safeParse({ ...AUDIO_ATTACHMENT, durationMs }).success
    expect(parseDuration(1)).toBe(true)
    expect(parseDuration(PARTICIPANT_AUDIO_DURATION_MAX_MS)).toBe(true)
    expect(parseDuration(0)).toBe(false)
    expect(parseDuration(-1)).toBe(false)
    expect(parseDuration(1.5)).toBe(false)
    expect(parseDuration(PARTICIPANT_AUDIO_DURATION_MAX_MS + 1)).toBe(false)
    assertExact<Exact<ParticipantAttachment['durationMs'], number | undefined>>()
  })

  it('aceita o anexo com transcrição e a mantém no resultado', () => {
    const parsed: ParticipantAttachment = participantAttachmentSchema.parse({
      ...AUDIO_ATTACHMENT,
      durationMs: 12_000,
      transcription: READY_TRANSCRIPTION,
    })
    expect(parsed.transcription).toEqual(READY_TRANSCRIPTION)
    assertExact<Exact<ParticipantAttachment['transcription'], ParticipantTranscription | undefined>>()
  })

  it('recusa o anexo inteiro quando a transcrição tem status desconhecido', () => {
    expect(
      participantAttachmentSchema.safeParse({ ...AUDIO_ATTACHMENT, transcription: { status: 'queued' } }).success,
    ).toBe(false)
  })

  it('mensagem com anexo de áudio transcrito e descarta text fora de ready', () => {
    const parsed: ParticipantMessage = participantMessageSchema.parse({
      ...VALID_MESSAGE,
      attachments: [{ ...AUDIO_ATTACHMENT, transcription: { status: 'pending', text: 'vazou' } }],
    })
    expect(parsed.attachments[0]?.transcription).toEqual({ status: 'pending' })
  })

  it('mensagem antiga, sem durationMs nem transcription, segue válida', () => {
    expect(participantMessageSchema.safeParse({ ...VALID_MESSAGE, attachments: [AUDIO_ATTACHMENT] }).success).toBe(true)
  })
})
