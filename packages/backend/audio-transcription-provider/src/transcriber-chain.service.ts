/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Encadeia engines de transcrição: o primeiro que responder ganha.
 *
 * Existe para que "adicionar um engine de reserva" seja configuração em vez de refactor. Sem a
 * cadeia, trocar de provedor obrigaria a mexer em quem chama — e o consumidor deste pacote é um
 * use-case que não deveria saber quantos engines existem.
 *
 * A cadeia tenta o próximo até em erro definitivo, e isso é deliberado: suporte a codec varia entre
 * engines. O Groq recusa AMR; um Whisper local com ffmpeg na frente converte AMR sem reclamar.
 * Parar no primeiro "formato não suportado" descartaria um áudio que o segundo engine transcreveria.
 */

import { TranscriptionError, isRetriableTranscriptionFailure } from './audio-transcription.error'
import type { AudioTranscriber, TranscriptionInput, TranscriptionResult } from './audio-transcription.types'

export type TranscriberChainConfig = Readonly<{
  /**
   * Observabilidade da degradação. Sem isto, a cadeia cair para o engine 2 (mais lento, ou pago) é
   * invisível: tudo continua "funcionando" e ninguém descobre que o engine 1 está fora há uma semana.
   */
  onEngineFailure?: (error: unknown, details: { engine: string; isLast: boolean }) => void
}>

export function createTranscriberChain(
  transcribers: readonly AudioTranscriber[],
  config: TranscriberChainConfig = {},
): AudioTranscriber {
  if (transcribers.length === 0) {
    throw new TranscriptionError('A cadeia precisa de pelo menos um engine.', 'chain', false)
  }

  // Um engine só: devolve ele mesmo. Envolver custaria um try/catch e um nome de cadeia no
  // resultado, escondendo qual engine realmente respondeu.
  const [only] = transcribers
  if (transcribers.length === 1 && only) return only

  const name = `chain(${transcribers.map((transcriber) => transcriber.name).join('>')})`

  async function transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const failures: unknown[] = []

    for (const [index, transcriber] of transcribers.entries()) {
      try {
        return await transcriber.transcribe(input)
      } catch (error) {
        failures.push(error)
        config.onEngineFailure?.(error, {
          engine: transcriber.name,
          isLast: index === transcribers.length - 1,
        })
      }
    }

    throw pickFailureToPropagate(failures)
  }

  return Object.freeze({ name, transcribe })
}

/**
 * Todos falharam — e o erro escolhido decide o destino do áudio no host.
 *
 * Prioriza o retriável: se QUALQUER engine disse "tente mais tarde", o áudio ainda é transcritível e
 * o certo é reenfileirar. Propagar o último erro (definitivo, do engine de reserva) marcaria como
 * perdido um áudio que só esbarrou na cota do engine principal.
 */
function pickFailureToPropagate(failures: readonly unknown[]): unknown {
  return failures.find(isRetriableTranscriptionFailure) ?? failures[failures.length - 1]
}
