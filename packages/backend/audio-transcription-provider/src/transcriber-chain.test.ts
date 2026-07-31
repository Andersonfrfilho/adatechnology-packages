/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createTranscriberChain } from './transcriber-chain.service'
import {
  TranscriptionError,
  TranscriptionRateLimitError,
  TranscriptionUnsupportedError,
} from './audio-transcription.error'
import type { AudioTranscriber, TranscriptionResult } from './audio-transcription.types'

const INPUT = { buffer: Buffer.from('audio'), mimeType: 'audio/ogg' }

function succeedingEngine(name: string, text: string): AudioTranscriber {
  return {
    name,
    transcribe: async (): Promise<TranscriptionResult> => ({ text, engine: name }),
  }
}

function failingEngine(name: string, error: unknown): AudioTranscriber {
  return {
    name,
    transcribe: async () => {
      throw error
    },
  }
}

describe('createTranscriberChain', () => {
  it('devolve o próprio engine quando há só um — sem envolver o nome numa cadeia', () => {
    const only = succeedingEngine('groq', 'oi')

    expect(createTranscriberChain([only])).toBe(only)
  })

  it('para no primeiro que responde', async () => {
    let secondWasCalled = false
    const chain = createTranscriberChain([
      succeedingEngine('groq', 'primeiro'),
      {
        name: 'whisper-local',
        transcribe: async () => {
          secondWasCalled = true
          return { text: 'segundo', engine: 'whisper-local' }
        },
      },
    ])

    const result = await chain.transcribe(INPUT)

    expect(result.text).toBe('primeiro')
    expect(secondWasCalled).toBe(false)
  })

  it('cai para o próximo engine mesmo em erro definitivo — suporte a codec varia', async () => {
    const chain = createTranscriberChain([
      failingEngine('groq', new TranscriptionUnsupportedError('groq', 'audio/amr')),
      succeedingEngine('whisper-local', 'transcrito pelo local'),
    ])

    const result = await chain.transcribe(INPUT)

    expect(result.text).toBe('transcrito pelo local')
    expect(result.engine).toBe('whisper-local')
  })

  it('propaga o erro retriável quando todos falham, para o host reenfileirar', async () => {
    // O engine 1 estourou cota (retriável) e o 2 falhou de forma definitiva. Propagar o último
    // marcaria como perdido um áudio que só esbarrou no limite do principal.
    const chain = createTranscriberChain([
      failingEngine('groq', new TranscriptionRateLimitError('groq', 30)),
      failingEngine('whisper-local', new TranscriptionError('sem modelo', 'whisper-local', false)),
    ])

    const error = await chain.transcribe(INPUT).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(TranscriptionRateLimitError)
  })

  it('propaga o último erro quando nenhum é retriável', async () => {
    const chain = createTranscriberChain([
      failingEngine('groq', new TranscriptionUnsupportedError('groq', 'audio/amr')),
      failingEngine('whisper-local', new TranscriptionError('modelo ausente', 'whisper-local', false)),
    ])

    const error = await chain.transcribe(INPUT).catch((caught: unknown) => caught)

    expect((error as TranscriptionError).engine).toBe('whisper-local')
  })

  it('avisa a cada degradação — cair para o reserva não pode ser silencioso', async () => {
    const failures: { engine: string; isLast: boolean }[] = []
    const chain = createTranscriberChain(
      [failingEngine('groq', new TranscriptionRateLimitError('groq')), succeedingEngine('whisper-local', 'ok')],
      { onEngineFailure: (_error, details) => failures.push(details) },
    )

    await chain.transcribe(INPUT)

    expect(failures).toEqual([{ engine: 'groq', isLast: false }])
  })

  it('recusa cadeia vazia na construção', () => {
    expect(() => createTranscriberChain([])).toThrow(/pelo menos um engine/)
  })
})
