import {
  AudioNotIngestedError,
  MessageNotAudioError,
  TranscriptionDisabledError,
} from '@adatechnology/meta-whatsapp-contracts'
import type { MetaWhatsAppHooks, ObjectStorageInterface } from '@adatechnology/meta-whatsapp-contracts'
import type { MessageRepository } from '../repositories/MessageRepository'
import type { MessageRow } from '../schema/schema'
import type { TranscriptionPolicyResolver } from './resolveTranscriptionPolicy'
import {
  TRANSCRIPTION_STATUS,
  isAudioMimeType,
  isRetriableTranscriptionError,
  isUnsupportedTranscriptionError,
  transcriptionRetryAfterSeconds,
  type AudioTranscriber,
  type TranscriptionStatus,
} from '../transcription.types'

/**
 * Storage com leitura garantida. `getObject` é opcional no contrato, então quem monta este use-case
 * precisa provar que o método existe — sem os bytes não há o que transcrever, e um use-case que
 * sempre falha é pior do que a ausência ser visível no tipo.
 */
type ReadableObjectStorage = ObjectStorageInterface & {
  getObject: NonNullable<ObjectStorageInterface['getObject']>
}

export type TranscribeAudioParams = {
  companyId: string
  messageId: string
  /**
   * Refaz mesmo com transcrição já salva. Serve ao "transcrever de novo" depois de trocar de engine
   * — sem isto, um resultado ruim do engine antigo ficaria congelado para sempre.
   */
  force?: boolean
}

export type TranscribeAudioResult = {
  status: TranscriptionStatus
  text: string | null
  language: string | null
  engine: string | null
  /** `true` quando devolveu o que já estava salvo, sem gastar cota. */
  alreadyTranscribed: boolean
}

export type TranscribeAudioDependencies = {
  messageRepository: MessageRepository
  objectStorage: ReadableObjectStorage
  transcriber: AudioTranscriber
  /**
   * Política por empresa. Ausente, a transcrição sob demanda não consulta configuração nenhuma e
   * atende sempre — que é o comportamento de quem controla o liga/desliga só por ambiente.
   */
  resolvePolicy?: TranscriptionPolicyResolver
  /** ISO 639-1 do produto. Informar corta a detecção do Whisper e evita pt-BR curto virar espanhol. */
  languageHint?: string
  hooks?: Pick<MetaWhatsAppHooks, 'onTranscriptionDeferred'>
}

/**
 * Transcreve o áudio de UMA mensagem já persistida e ingerida.
 *
 * Serve aos dois modos: é o que o painel chama no botão "transcrever" (`onDemand`) e é o que o host
 * chama ao retomar um `pending` reenfileirado. O modo `auto` não passa por aqui — ele transcreve
 * dentro da ingestão, onde o buffer já está em memória e não custa um segundo download.
 *
 * Idempotente por `transcription_status`: chamar de novo num `'done'` devolve o que está salvo em
 * vez de gastar cota transcrevendo o mesmo áudio.
 */
export class TranscribeAudioUseCase {
  constructor(private readonly dependencies: TranscribeAudioDependencies) {}

  async execute(params: TranscribeAudioParams): Promise<TranscribeAudioResult> {
    const message = await this.dependencies.messageRepository.findById(params.companyId, params.messageId)
    if (!message) throw new Error(`Mensagem ${params.messageId} não encontrada para transcrição`)

    /**
     * Devolver o que já está salvo vem ANTES da checagem de política, e de propósito: o texto já
     * existe, já aparece na conversa, e desligar o recurso depois não deve apagar nem esconder o que
     * foi transcrito enquanto estava ligado. A política governa gastar cota, não ler o passado.
     */
    if (message.transcriptionStatus === TRANSCRIPTION_STATUS.DONE && !params.force) {
      return {
        status: TRANSCRIPTION_STATUS.DONE,
        text: message.transcriptionText,
        language: message.transcriptionLanguage,
        engine: message.transcriptionEngine,
        alreadyTranscribed: true,
      }
    }

    // Daqui para baixo gasta cota, então a política manda.
    if (this.dependencies.resolvePolicy) {
      const policy = await this.dependencies.resolvePolicy(params.companyId)
      if (!policy.isEnabled) throw new TranscriptionDisabledError()
    }

    const audio = extractAudioReference(message)
    const buffer = await this.dependencies.objectStorage.getObject(audio.uploadId)

    return this.transcribeBuffer({ ...params, buffer, mimeType: audio.mimeType, uploadId: audio.uploadId, message })
  }

  private async transcribeBuffer(context: {
    companyId: string
    messageId: string
    buffer: Buffer
    mimeType: string
    uploadId: string
    message: MessageRow
  }): Promise<TranscribeAudioResult> {
    try {
      const result = await this.dependencies.transcriber.transcribe({
        buffer: context.buffer,
        mimeType: context.mimeType,
        ...(this.dependencies.languageHint ? { languageHint: this.dependencies.languageHint } : {}),
      })

      await this.dependencies.messageRepository.saveTranscription({
        companyId: context.companyId,
        messageId: context.messageId,
        status: TRANSCRIPTION_STATUS.DONE,
        text: result.text,
        language: result.language ?? null,
        engine: result.engine,
      })

      return {
        status: TRANSCRIPTION_STATUS.DONE,
        text: result.text,
        language: result.language ?? null,
        engine: result.engine,
        alreadyTranscribed: false,
      }
    } catch (error) {
      await this.persistFailure(context, error)
      throw error
    }
  }

  /**
   * Carimba o motivo antes de propagar. O status é o que impede os dois desperdícios simétricos:
   * reprocessar para sempre um codec impossível, e desistir de um áudio que só esbarrou na cota.
   */
  private async persistFailure(
    context: { companyId: string; messageId: string; uploadId: string; message: MessageRow },
    error: unknown,
  ): Promise<void> {
    const status = resolveFailureStatus(error)

    await this.dependencies.messageRepository.saveTranscription({
      companyId: context.companyId,
      messageId: context.messageId,
      status,
    })

    if (status !== TRANSCRIPTION_STATUS.PENDING) return

    const retryAfterSeconds = transcriptionRetryAfterSeconds(error)
    await this.dependencies.hooks?.onTranscriptionDeferred?.({
      companyId: context.companyId,
      messageId: context.messageId,
      whatsappNumber: context.message.whatsappNumber,
      uploadId: context.uploadId,
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      reason: retryAfterSeconds !== undefined ? 'rate-limited' : 'transient-failure',
      error,
    })
  }
}

export function resolveFailureStatus(error: unknown): TranscriptionStatus {
  if (isUnsupportedTranscriptionError(error)) return TRANSCRIPTION_STATUS.UNSUPPORTED
  return isRetriableTranscriptionError(error) ? TRANSCRIPTION_STATUS.PENDING : TRANSCRIPTION_STATUS.FAILED
}

/**
 * Onde o áudio está e em que formato.
 *
 * Lê do `payload`, que é onde a ingestão gravou `uploadId` e `mimeType` — a tabela de documentos
 * também tem o dado, mas exigiria uma consulta a mais por mensagem e não é a fonte que a ingestão
 * atualiza primeiro.
 */
function extractAudioReference(message: MessageRow): { uploadId: string; mimeType: string } {
  const payload = (message.payload ?? {}) as Record<string, unknown>
  const audio = payload['audio'] as { mime_type?: string } | undefined
  const mimeType = typeof payload['mimeType'] === 'string' ? payload['mimeType'] : audio?.mime_type

  // `type` do host é rótulo livre (varchar(32)), então a checagem real é o mime — é ele que diz se
  // existe áudio para transcrever, independente de como o produto nomeou a mensagem.
  if (!isAudioMimeType(mimeType) && !audio) {
    throw new MessageNotAudioError(message.id, message.type)
  }

  const uploadId = payload['uploadId']
  // Sem uploadId a ingestão ainda não terminou. O áudio existe na Meta, mas a URL de lá expira e
  // não é este use-case que a busca — quem copia é a ingestão, e ela é assíncrona.
  if (typeof uploadId !== 'string' || uploadId.length === 0) {
    throw new AudioNotIngestedError(message.id)
  }

  return { uploadId, mimeType: mimeType ?? 'audio/ogg' }
}
