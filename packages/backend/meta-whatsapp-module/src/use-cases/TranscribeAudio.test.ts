import { describe, expect, it } from 'bun:test'

import {
  AudioNotIngestedError,
  MessageNotAudioError,
  TranscriptionDisabledError,
} from '@adatechnology/meta-whatsapp-contracts'
import type { TranscriptionDeferredDescriptor } from '@adatechnology/meta-whatsapp-contracts'
import { TranscribeAudioUseCase, type TranscribeAudioDependencies } from './TranscribeAudio.use-case'
import type { MessageRepository, SaveTranscriptionParams } from '../repositories/MessageRepository'
import type { MessageRow } from '../schema/schema'
import { TRANSCRIPTION_STATUS, type AudioTranscriber } from '../transcription.types'

const COMPANY_ID = '22222222-2222-2222-2222-222222222222'
const MESSAGE_ID = '33333333-3333-3333-3333-333333333333'
const UPLOAD_ID = 'upload-abc'

function audioMessage(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: MESSAGE_ID,
    companyId: COMPANY_ID,
    whatsappNumber: '5511999999999',
    type: 'audio',
    payload: { uploadId: UPLOAD_ID, mimeType: 'audio/ogg; codecs=opus' },
    transcriptionStatus: null,
    transcriptionText: null,
    transcriptionLanguage: null,
    transcriptionEngine: null,
    ...overrides,
  } as unknown as MessageRow
}

function buildDependencies(options: {
  message?: MessageRow
  transcriber: AudioTranscriber
  onTranscriptionDeferred?: (details: TranscriptionDeferredDescriptor) => void
}) {
  const saved: SaveTranscriptionParams[] = []
  const deferred: TranscriptionDeferredDescriptor[] = []

  const messageRepository = {
    findById: async () => options.message ?? audioMessage(),
    saveTranscription: async (params: SaveTranscriptionParams) => {
      saved.push(params)
      return undefined
    },
  } as unknown as MessageRepository

  const dependencies: TranscribeAudioDependencies = {
    messageRepository,
    objectStorage: {
      upload: async () => ({ uploadId: UPLOAD_ID }),
      getDownloadUrl: async () => 'https://example.test/audio',
      getObject: async () => Buffer.from('fake-audio-bytes'),
    },
    transcriber: options.transcriber,
    languageHint: 'pt',
    hooks: {
      onTranscriptionDeferred: async (details) => {
        deferred.push(details)
        options.onTranscriptionDeferred?.(details)
      },
    },
  }

  return { dependencies, saved, deferred }
}

function transcriberReturning(text: string, engine = 'groq'): AudioTranscriber {
  return { name: engine, transcribe: async () => ({ text, language: 'portuguese', engine }) }
}

function transcriberThrowing(error: unknown): AudioTranscriber {
  return {
    name: 'groq',
    transcribe: async () => {
      throw error
    },
  }
}

describe('TranscribeAudioUseCase', () => {
  it('transcreve e persiste texto, idioma e engine', async () => {
    const { dependencies, saved } = buildDependencies({ transcriber: transcriberReturning('quero dois pães') })

    const result = await new TranscribeAudioUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      messageId: MESSAGE_ID,
    })

    expect(result.status).toBe(TRANSCRIPTION_STATUS.DONE)
    expect(result.text).toBe('quero dois pães')
    expect(result.alreadyTranscribed).toBe(false)
    expect(saved[0]).toEqual({
      companyId: COMPANY_ID,
      messageId: MESSAGE_ID,
      status: 'done',
      text: 'quero dois pães',
      language: 'portuguese',
      engine: 'groq',
    })
  })

  it('devolve a transcrição salva sem gastar cota', async () => {
    let engineWasCalled = false
    const { dependencies, saved } = buildDependencies({
      message: audioMessage({
        transcriptionStatus: 'done',
        transcriptionText: 'já transcrito',
        transcriptionEngine: 'groq',
      }),
      transcriber: {
        name: 'groq',
        transcribe: async () => {
          engineWasCalled = true
          return { text: 'novo', engine: 'groq' }
        },
      },
    })

    const result = await new TranscribeAudioUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      messageId: MESSAGE_ID,
    })

    expect(result.alreadyTranscribed).toBe(true)
    expect(result.text).toBe('já transcrito')
    expect(engineWasCalled).toBe(false)
    expect(saved).toEqual([])
  })

  it('refaz quando `force` — trocar de engine não pode congelar resultado ruim', async () => {
    const { dependencies, saved } = buildDependencies({
      message: audioMessage({ transcriptionStatus: 'done', transcriptionText: 'ruim' }),
      transcriber: transcriberReturning('bom', 'whisper-local'),
    })

    const result = await new TranscribeAudioUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      messageId: MESSAGE_ID,
      force: true,
    })

    expect(result.text).toBe('bom')
    expect(saved[0]?.engine).toBe('whisper-local')
  })

  it('grava `pending` e avisa o host quando estoura cota', async () => {
    const rateLimited = Object.assign(new Error('cota'), {
      name: 'TranscriptionRateLimitError',
      isRetriable: true,
      retryAfterSeconds: 42,
    })
    const { dependencies, saved, deferred } = buildDependencies({ transcriber: transcriberThrowing(rateLimited) })

    await expect(
      new TranscribeAudioUseCase(dependencies).execute({ companyId: COMPANY_ID, messageId: MESSAGE_ID }),
    ).rejects.toThrow('cota')

    expect(saved[0]?.status).toBe(TRANSCRIPTION_STATUS.PENDING)
    // O texto não é tocado: uma retentativa não pode apagar transcrição parcial anterior.
    expect(saved[0]?.text).toBeUndefined()
    expect(deferred[0]?.reason).toBe('rate-limited')
    expect(deferred[0]?.retryAfterSeconds).toBe(42)
    expect(deferred[0]?.uploadId).toBe(UPLOAD_ID)
  })

  it('grava `unsupported` e NÃO avisa o host — retry não conserta codec', async () => {
    const unsupported = Object.assign(new Error('amr'), {
      name: 'TranscriptionUnsupportedError',
      isRetriable: false,
    })
    const { dependencies, saved, deferred } = buildDependencies({ transcriber: transcriberThrowing(unsupported) })

    await expect(
      new TranscribeAudioUseCase(dependencies).execute({ companyId: COMPANY_ID, messageId: MESSAGE_ID }),
    ).rejects.toThrow('amr')

    expect(saved[0]?.status).toBe(TRANSCRIPTION_STATUS.UNSUPPORTED)
    expect(deferred).toEqual([])
  })

  it('grava `failed` em erro definitivo que não é de formato', async () => {
    const badKey = Object.assign(new Error('401'), { name: 'TranscriptionError', isRetriable: false })
    const { dependencies, saved, deferred } = buildDependencies({ transcriber: transcriberThrowing(badKey) })

    await expect(
      new TranscribeAudioUseCase(dependencies).execute({ companyId: COMPANY_ID, messageId: MESSAGE_ID }),
    ).rejects.toThrow('401')

    expect(saved[0]?.status).toBe(TRANSCRIPTION_STATUS.FAILED)
    expect(deferred).toEqual([])
  })

  it('trata erro sem carimbo como retriável — falha nua quase sempre é rede', async () => {
    const { dependencies, saved } = buildDependencies({ transcriber: transcriberThrowing(new Error('ECONNRESET')) })

    await expect(
      new TranscribeAudioUseCase(dependencies).execute({ companyId: COMPANY_ID, messageId: MESSAGE_ID }),
    ).rejects.toThrow('ECONNRESET')

    expect(saved[0]?.status).toBe(TRANSCRIPTION_STATUS.PENDING)
  })

  it('aceita texto vazio como `done` — silêncio processado não deve voltar para a fila', async () => {
    const { dependencies, saved } = buildDependencies({ transcriber: transcriberReturning('') })

    const result = await new TranscribeAudioUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      messageId: MESSAGE_ID,
    })

    expect(result.status).toBe(TRANSCRIPTION_STATUS.DONE)
    expect(saved[0]?.status).toBe(TRANSCRIPTION_STATUS.DONE)
    expect(saved[0]?.text).toBe('')
  })

  it('recusa mensagem que não é áudio', async () => {
    const { dependencies } = buildDependencies({
      message: audioMessage({ type: 'document', payload: { uploadId: UPLOAD_ID, mimeType: 'application/pdf' } }),
      transcriber: transcriberReturning('nunca'),
    })

    await expect(
      new TranscribeAudioUseCase(dependencies).execute({ companyId: COMPANY_ID, messageId: MESSAGE_ID }),
    ).rejects.toBeInstanceOf(MessageNotAudioError)
  })

  it('distingue "áudio ainda sendo copiado" de erro — a UI precisa dizer "tente em instantes"', async () => {
    const { dependencies } = buildDependencies({
      message: audioMessage({ payload: { mimeType: 'audio/ogg' } }),
      transcriber: transcriberReturning('nunca'),
    })

    await expect(
      new TranscribeAudioUseCase(dependencies).execute({ companyId: COMPANY_ID, messageId: MESSAGE_ID }),
    ).rejects.toBeInstanceOf(AudioNotIngestedError)
  })

  it('recusa quando a transcrição está desligada para a empresa', async () => {
    let engineWasCalled = false
    const { dependencies } = buildDependencies({
      transcriber: {
        name: 'groq',
        transcribe: async () => {
          engineWasCalled = true
          return { text: 'nunca', engine: 'groq' }
        },
      },
    })

    await expect(
      new TranscribeAudioUseCase({
        ...dependencies,
        resolvePolicy: async () => ({ isEnabled: false, mode: 'onDemand' }),
      }).execute({ companyId: COMPANY_ID, messageId: MESSAGE_ID }),
    ).rejects.toBeInstanceOf(TranscriptionDisabledError)

    expect(engineWasCalled).toBe(false)
  })

  /**
   * Desligar o recurso não pode apagar nem esconder o que já foi transcrito enquanto estava ligado.
   * A política governa gastar cota, não ler o passado.
   */
  it('ainda devolve transcrição já salva mesmo com a empresa desligada', async () => {
    const { dependencies } = buildDependencies({
      message: audioMessage({ transcriptionStatus: 'done', transcriptionText: 'transcrito antes' }),
      transcriber: transcriberReturning('nunca'),
    })

    const result = await new TranscribeAudioUseCase({
      ...dependencies,
      resolvePolicy: async () => ({ isEnabled: false, mode: 'onDemand' }),
    }).execute({ companyId: COMPANY_ID, messageId: MESSAGE_ID })

    expect(result.text).toBe('transcrito antes')
    expect(result.alreadyTranscribed).toBe(true)
  })

  it('sem resolvedor de política, atende sempre — host que controla só por ambiente', async () => {
    const { dependencies, saved } = buildDependencies({ transcriber: transcriberReturning('ok') })

    const result = await new TranscribeAudioUseCase(dependencies).execute({
      companyId: COMPANY_ID,
      messageId: MESSAGE_ID,
    })

    expect(result.status).toBe(TRANSCRIPTION_STATUS.DONE)
    expect(saved[0]?.status).toBe(TRANSCRIPTION_STATUS.DONE)
  })

  it('reconhece áudio pelo bloco cru da Meta quando o host rotulou o tipo de outra forma', async () => {
    const { dependencies, saved } = buildDependencies({
      message: audioMessage({
        type: 'voice_note',
        payload: { uploadId: UPLOAD_ID, audio: { mime_type: 'audio/ogg; codecs=opus' } },
      }),
      transcriber: transcriberReturning('oi'),
    })

    await new TranscribeAudioUseCase(dependencies).execute({ companyId: COMPANY_ID, messageId: MESSAGE_ID })

    expect(saved[0]?.status).toBe(TRANSCRIPTION_STATUS.DONE)
  })
})
