/**
 * Vocabulário de transcrição de áudio do módulo.
 *
 * Fica em arquivo próprio porque o schema e os dois use-cases (ingestão automática e sob demanda)
 * precisam dos mesmos tipos, e pendurá-los em qualquer um dos três faria os outros dois importarem
 * de dentro de uma camada que não é a deles.
 */

import type { TranscriptionMode } from '@adatechnology/meta-whatsapp-contracts'

export const TRANSCRIPTION_STATUS = {
  /** Falhou de forma retriável (cota, rede, 5xx) — vai sair quando alguém tentar de novo. */
  PENDING: 'pending',
  /** Processado. Texto vazio aqui é áudio em silêncio, e NÃO deve ser reprocessado. */
  DONE: 'done',
  /** Falha definitiva do engine (credencial, áudio corrompido, arquivo grande demais). */
  FAILED: 'failed',
  /** Nenhum engine da cadeia aceita o formato. Retentar não conserta codec. */
  UNSUPPORTED: 'unsupported',
} as const

export type TranscriptionStatus = (typeof TRANSCRIPTION_STATUS)[keyof typeof TRANSCRIPTION_STATUS]

/**
 * Quando transcrever.
 *
 * `auto` transcreve durante a ingestão da mídia, onde o buffer do áudio JÁ está em memória — não
 * custa um segundo download do storage. `onDemand` só transcreve quando o atendente pede, o que
 * troca latência na interface por não gastar cota com áudio que ninguém vai ler.
 *
 * O tipo vem do contrato (o painel escolhe, a API transporta, o módulo obedece) e `satisfies`
 * garante em tempo de compilação que estes valores continuam sendo exatamente os de lá — sem isso,
 * um modo novo no contrato passaria despercebido aqui.
 */
export const TRANSCRIPTION_MODE = {
  AUTO: 'auto',
  ON_DEMAND: 'onDemand',
} as const satisfies Record<string, TranscriptionMode>

export type { TranscriptionMode }

/**
 * O contrato mínimo de `@adatechnology/audio-transcription-provider`, declarado aqui em vez de
 * importado — mesma decisão do `MessageModerator` em `LogMessage.use-case.ts`.
 *
 * Assim o módulo não ganha dependência de pacote por um recurso opcional, e transcrição não fica
 * amarrada a WhatsApp: o que atravessa esta fronteira é um buffer de áudio e um mime.
 */
export type AudioTranscriber = {
  readonly name: string
  transcribe: (input: {
    buffer: Buffer
    mimeType: string
    languageHint?: string
  }) => Promise<{ text: string; language?: string; durationSeconds?: number; engine: string }>
}

/**
 * Recorte do erro do provider que o módulo precisa ler para escolher entre `'pending'` e
 * `'failed'`. Estrutural, não `instanceof`: o provider é opcional e pode nem estar instalado, e um
 * `instanceof` contra classe ausente não compila.
 */
export function isRetriableTranscriptionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return true
  const isRetriable = (error as { isRetriable?: unknown }).isRetriable
  // Ausente conta como retriável: erro sem carimbo é quase sempre rede, e insistir é barato.
  return typeof isRetriable === 'boolean' ? isRetriable : true
}

export function isUnsupportedTranscriptionError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'TranscriptionUnsupportedError'
  )
}

export function transcriptionRetryAfterSeconds(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const retryAfter = (error as { retryAfterSeconds?: unknown }).retryAfterSeconds
  return typeof retryAfter === 'number' ? retryAfter : undefined
}

/** Mime de áudio? Só áudio é transcrito — vídeo, imagem e documento passam sem tocar no engine. */
export function isAudioMimeType(mimeType: string | undefined | null): boolean {
  return typeof mimeType === 'string' && mimeType.trim().toLowerCase().startsWith('audio/')
}
