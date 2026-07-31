/**
 * O que estes testes travam é a regra que não pode regredir: falha de transcrição **nunca** derruba
 * a ingestão. Quando ela roda, o binário já está no storage e já entrou na biblioteca — deixar o
 * erro subir faria o retry do host baixar de novo da Meta um arquivo que está salvo.
 */

import { describe, expect, it } from 'bun:test'

import type { TranscriptionDeferredDescriptor } from '@adatechnology/meta-whatsapp-contracts'
import type { ChannelAdapterInterface, ObjectStorageInterface } from '@adatechnology/meta-whatsapp-contracts'
import { IngestInboundMediaUseCase, type IngestTranscriptionOptions } from './IngestInboundMedia.use-case'
import type { MetaWhatsAppDatabase } from '../database.types'
import type { MessageRepository, SaveTranscriptionParams } from '../repositories/MessageRepository'
import type { MessageRow } from '../schema/schema'
import {
  TRANSCRIPTION_MODE,
  TRANSCRIPTION_STATUS,
  type AudioTranscriber,
  type TranscriptionMode,
} from '../transcription.types'

const COMPANY_ID = '22222222-2222-2222-2222-222222222222'
const MESSAGE_ID = '33333333-3333-3333-3333-333333333333'
const SOURCE_MEDIA_ID = 'meta-media-1'

function messageRow(): MessageRow {
  return {
    id: MESSAGE_ID,
    companyId: COMPANY_ID,
    sessionId: '11111111-1111-1111-1111-111111111111',
    whatsappNumber: '5511999999999',
    sender: 'customer',
    type: 'audio',
    payload: { audio: { id: SOURCE_MEDIA_ID, mime_type: 'audio/ogg; codecs=opus' } },
  } as unknown as MessageRow
}

/** Fake mínimo da cadeia do drizzle que este use-case usa: um select e um update. */
function fakeDatabase(): MetaWhatsAppDatabase {
  return {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [messageRow()] }),
      }),
    }),
    update: () => ({
      set: () => ({ where: async () => undefined }),
    }),
  } as unknown as MetaWhatsAppDatabase
}

const channel = {
  fetchMediaAsBase64: async () => ({
    data: Buffer.from('fake-ogg-bytes').toString('base64'),
    mimeType: 'audio/ogg; codecs=opus',
  }),
} as unknown as ChannelAdapterInterface

const objectStorage = {
  upload: async () => ({ uploadId: 'upload-abc' }),
  getDownloadUrl: async () => 'https://example.test/audio',
} as unknown as ObjectStorageInterface

function buildTranscription(options: {
  transcriber: AudioTranscriber
  mode?: TranscriptionMode
  /** Simula o interruptor do painel desligado para esta empresa. */
  isEnabled?: boolean
}) {
  const saved: SaveTranscriptionParams[] = []
  const deferred: TranscriptionDeferredDescriptor[] = []
  const policyLookups: string[] = []

  const transcription: IngestTranscriptionOptions = {
    transcriber: options.transcriber,
    resolvePolicy: async (companyId: string) => {
      policyLookups.push(companyId)
      return { isEnabled: options.isEnabled ?? true, mode: options.mode ?? TRANSCRIPTION_MODE.AUTO }
    },
    messageRepository: {
      saveTranscription: async (params: SaveTranscriptionParams) => {
        saved.push(params)
        return undefined
      },
    } as unknown as MessageRepository,
    languageHint: 'pt',
    hooks: {
      onTranscriptionDeferred: async (details) => {
        deferred.push(details)
      },
    },
  }

  return { transcription, saved, deferred, policyLookups }
}

function ingestParams(mimeType = 'audio/ogg; codecs=opus') {
  return { companyId: COMPANY_ID, messageId: MESSAGE_ID, sourceMediaId: SOURCE_MEDIA_ID, mimeType }
}

describe('IngestInboundMediaUseCase — transcrição automática', () => {
  it('transcreve o áudio recém-baixado no modo auto', async () => {
    const { transcription, saved } = buildTranscription({
      transcriber: { name: 'groq', transcribe: async () => ({ text: 'oi tudo bem', engine: 'groq' }) },
    })
    const useCase = new IngestInboundMediaUseCase(fakeDatabase(), channel, objectStorage, undefined, transcription)

    const result = await useCase.execute(ingestParams())

    expect(result.transcription?.status).toBe(TRANSCRIPTION_STATUS.DONE)
    expect(saved[0]?.text).toBe('oi tudo bem')
  })

  it('passa o buffer já baixado ao engine — não relê do storage', async () => {
    let receivedBytes: string | undefined
    const { transcription } = buildTranscription({
      transcriber: {
        name: 'groq',
        transcribe: async (input) => {
          receivedBytes = input.buffer.toString('utf8')
          return { text: 'ok', engine: 'groq' }
        },
      },
    })
    const useCase = new IngestInboundMediaUseCase(fakeDatabase(), channel, objectStorage, undefined, transcription)

    await useCase.execute(ingestParams())

    expect(receivedBytes).toBe('fake-ogg-bytes')
  })

  it('não transcreve no modo sob demanda', async () => {
    let engineWasCalled = false
    const { transcription } = buildTranscription({
      mode: TRANSCRIPTION_MODE.ON_DEMAND,
      transcriber: {
        name: 'groq',
        transcribe: async () => {
          engineWasCalled = true
          return { text: 'nunca', engine: 'groq' }
        },
      },
    })
    const useCase = new IngestInboundMediaUseCase(fakeDatabase(), channel, objectStorage, undefined, transcription)

    const result = await useCase.execute(ingestParams())

    expect(engineWasCalled).toBe(false)
    expect(result.transcription).toBeUndefined()
    expect(result.uploadId).toBe('upload-abc')
  })

  it('ignora mídia que não é áudio', async () => {
    let engineWasCalled = false
    const { transcription } = buildTranscription({
      transcriber: {
        name: 'groq',
        transcribe: async () => {
          engineWasCalled = true
          return { text: 'nunca', engine: 'groq' }
        },
      },
    })
    // O canal devolve o mime real do binário; um PDF não pode chegar ao engine de fala.
    const documentChannel = {
      fetchMediaAsBase64: async () => ({ data: 'JVBERi0=', mimeType: 'application/pdf' }),
    } as unknown as ChannelAdapterInterface
    const useCase = new IngestInboundMediaUseCase(
      fakeDatabase(),
      documentChannel,
      objectStorage,
      undefined,
      transcription,
    )

    const result = await useCase.execute(ingestParams('application/pdf'))

    expect(engineWasCalled).toBe(false)
    expect(result.transcription).toBeUndefined()
  })

  it('NÃO derruba a ingestão quando a transcrição falha — o binário já está salvo', async () => {
    const rateLimited = Object.assign(new Error('cota'), {
      name: 'TranscriptionRateLimitError',
      isRetriable: true,
      retryAfterSeconds: 30,
    })
    const { transcription, saved, deferred } = buildTranscription({
      transcriber: {
        name: 'groq',
        transcribe: async () => {
          throw rateLimited
        },
      },
    })
    const useCase = new IngestInboundMediaUseCase(fakeDatabase(), channel, objectStorage, undefined, transcription)

    const result = await useCase.execute(ingestParams())

    expect(result.uploadId).toBe('upload-abc')
    expect(result.transcription?.status).toBe(TRANSCRIPTION_STATUS.PENDING)
    expect(saved[0]?.status).toBe(TRANSCRIPTION_STATUS.PENDING)
    // O host recebe o uploadId para enfileirar uma TRANSCRIÇÃO, não uma segunda ingestão.
    expect(deferred[0]?.uploadId).toBe('upload-abc')
    expect(deferred[0]?.retryAfterSeconds).toBe(30)
  })

  it('marca unsupported sem pedir retomada quando nenhum engine aceita o codec', async () => {
    const unsupported = Object.assign(new Error('amr'), {
      name: 'TranscriptionUnsupportedError',
      isRetriable: false,
    })
    const { transcription, saved, deferred } = buildTranscription({
      transcriber: {
        name: 'groq',
        transcribe: async () => {
          throw unsupported
        },
      },
    })
    const useCase = new IngestInboundMediaUseCase(fakeDatabase(), channel, objectStorage, undefined, transcription)

    const result = await useCase.execute(ingestParams())

    expect(result.transcription?.status).toBe(TRANSCRIPTION_STATUS.UNSUPPORTED)
    expect(saved[0]?.status).toBe(TRANSCRIPTION_STATUS.UNSUPPORTED)
    expect(deferred).toEqual([])
  })

  it('respeita o interruptor da empresa desligado, mesmo com o host em modo auto', async () => {
    let engineWasCalled = false
    const { transcription, saved } = buildTranscription({
      isEnabled: false,
      transcriber: {
        name: 'groq',
        transcribe: async () => {
          engineWasCalled = true
          return { text: 'nunca', engine: 'groq' }
        },
      },
    })
    const useCase = new IngestInboundMediaUseCase(fakeDatabase(), channel, objectStorage, undefined, transcription)

    const result = await useCase.execute(ingestParams())

    expect(engineWasCalled).toBe(false)
    expect(result.transcription).toBeUndefined()
    // Nem grava status: desligado é "não avaliado", não "falhou".
    expect(saved).toEqual([])
    // A mídia continua ingerida normalmente.
    expect(result.uploadId).toBe('upload-abc')
  })

  it('consulta a política pela empresa da mensagem', async () => {
    const { transcription, policyLookups } = buildTranscription({
      transcriber: { name: 'groq', transcribe: async () => ({ text: 'oi', engine: 'groq' }) },
    })
    const useCase = new IngestInboundMediaUseCase(fakeDatabase(), channel, objectStorage, undefined, transcription)

    await useCase.execute(ingestParams())

    expect(policyLookups).toEqual([COMPANY_ID])
  })

  it('não gasta leitura de configuração com mídia que não é áudio', async () => {
    const { transcription, policyLookups } = buildTranscription({
      transcriber: { name: 'groq', transcribe: async () => ({ text: 'nunca', engine: 'groq' }) },
    })
    const documentChannel = {
      fetchMediaAsBase64: async () => ({ data: 'JVBERi0=', mimeType: 'application/pdf' }),
    } as unknown as ChannelAdapterInterface
    const useCase = new IngestInboundMediaUseCase(
      fakeDatabase(),
      documentChannel,
      objectStorage,
      undefined,
      transcription,
    )

    await useCase.execute(ingestParams('application/pdf'))

    expect(policyLookups).toEqual([])
  })

  it('sem transcrição injetada se comporta como antes do recurso existir', async () => {
    const useCase = new IngestInboundMediaUseCase(fakeDatabase(), channel, objectStorage)

    const result = await useCase.execute(ingestParams())

    expect(result).toEqual({ uploadId: 'upload-abc', alreadyIngested: false })
  })
})
