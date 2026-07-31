/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/**
 * A distinção que este arquivo existe para carimbar é `isRetriable`.
 *
 * Sem ela, quem consome só sabe "não transcreveu" e tem duas escolhas ruins: desistir de um áudio
 * que teria funcionado dez minutos depois, ou reprocessar para sempre um formato que nenhum engine
 * aceita. Estourar cota é espera; codec desconhecido é definitivo. O host precisa saber qual dos
 * dois aconteceu para decidir entre reenfileirar e encerrar.
 */
export class TranscriptionError extends Error {
  constructor(
    message: string,
    public readonly engine: string,
    public readonly isRetriable: boolean,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'TranscriptionError'
  }
}

/**
 * Cota estourada. Sempre retriável — é o caso em que o áudio está perfeitamente transcritível e só
 * a janela de tempo está fechada.
 */
export class TranscriptionRateLimitError extends TranscriptionError {
  constructor(
    engine: string,
    /** Do header `Retry-After`, quando o engine informa. É o intervalo a respeitar no reenfileiramento. */
    public readonly retryAfterSeconds?: number,
    cause?: unknown,
  ) {
    super(`Cota de transcrição estourada em ${engine}.`, engine, true, cause)
    this.name = 'TranscriptionRateLimitError'
  }
}

/**
 * Formato que o engine não aceita. Nunca retriável **no mesmo engine** — mas a cadeia ainda tenta o
 * próximo, porque suporte a codec varia: o Groq recusa AMR, e um Whisper local com ffmpeg na frente
 * converte AMR sem reclamar.
 */
export class TranscriptionUnsupportedError extends TranscriptionError {
  constructor(
    engine: string,
    public readonly mimeType: string,
    cause?: unknown,
  ) {
    super(`Formato ${mimeType} não suportado por ${engine}.`, engine, false, cause)
    this.name = 'TranscriptionUnsupportedError'
  }
}

export function isTranscriptionError(value: unknown): value is TranscriptionError {
  return value instanceof TranscriptionError
}

/** Erro desconhecido conta como retriável: falha de rede é o caso comum, e insistir é barato. */
export function isRetriableTranscriptionFailure(value: unknown): boolean {
  return isTranscriptionError(value) ? value.isRetriable : true
}
