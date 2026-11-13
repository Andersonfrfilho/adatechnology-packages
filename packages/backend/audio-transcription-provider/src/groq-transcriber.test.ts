/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createGroqTranscriber } from './groq-transcriber.service'
import {
  TranscriptionRateLimitError,
  TranscriptionUnsupportedError,
  isTranscriptionError,
} from './audio-transcription.error'
import type { FetchImplementation } from './audio-transcription.types'

const OGG_OPUS = 'audio/ogg; codecs=opus'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

function transcriberWith(fetchImplementation: FetchImplementation) {
  return createGroqTranscriber({ apiKey: 'test-key', fetchImplementation })
}

describe('createGroqTranscriber', () => {
  it('transcreve o formato que a Meta entrega e devolve idioma e duração', async () => {
    const transcriber = transcriberWith(async () =>
      jsonResponse({ text: '  bom dia, quero dois pães  ', language: 'portuguese', duration: 3.2 }),
    )

    const result = await transcriber.transcribe({ buffer: Buffer.from('fake-ogg'), mimeType: OGG_OPUS })

    expect(result.text).toBe('bom dia, quero dois pães')
    expect(result.language).toBe('portuguese')
    expect(result.durationSeconds).toBe(3.2)
    expect(result.engine).toBe('groq')
  })

  it('colapsa o loop de repetição do Whisper antes de devolver o texto', async () => {
    const looped = `bom dia. ${'de coletivo, '.repeat(40)}quero dois pães.`
    const transcriber = transcriberWith(async () => jsonResponse({ text: looped }))

    const result = await transcriber.transcribe({ buffer: Buffer.from('fake-ogg'), mimeType: OGG_OPUS })

    expect(result.text).toBe('bom dia. de coletivo, quero dois pães.')
  })

  it('manda o arquivo com extensão derivada do mime — o Groq escolhe o decoder pelo sufixo', async () => {
    let sentFilename: string | undefined
    let sentModel: unknown

    const transcriber = transcriberWith(async (_url, init) => {
      const form = init.body as FormData
      const file = form.get('file') as File
      sentFilename = file.name
      sentModel = form.get('model')
      return jsonResponse({ text: 'ok' })
    })

    await transcriber.transcribe({ buffer: Buffer.from('fake-ogg'), mimeType: OGG_OPUS })

    expect(sentFilename).toBe('audio.ogg')
    expect(sentModel).toBe('whisper-large-v3-turbo')
  })

  it('recusa mime fora da tabela sem gastar requisição', async () => {
    let called = false
    const transcriber = transcriberWith(async () => {
      called = true
      return jsonResponse({ text: '' })
    })

    // AMR é o caso real: o Groq não aceita, e é para isso que existe o engine local na cadeia.
    await expect(transcriber.transcribe({ buffer: Buffer.from('x'), mimeType: 'audio/amr' })).rejects.toBeInstanceOf(
      TranscriptionUnsupportedError,
    )
    expect(called).toBe(false)
  })

  it('marca 429 como retriável e lê o Retry-After', async () => {
    const transcriber = transcriberWith(async () =>
      jsonResponse({ error: 'rate limited' }, { status: 429, headers: { 'retry-after': '42' } }),
    )

    const error = await transcriber
      .transcribe({ buffer: Buffer.from('fake-ogg'), mimeType: OGG_OPUS })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(TranscriptionRateLimitError)
    expect((error as TranscriptionRateLimitError).retryAfterSeconds).toBe(42)
    expect((error as TranscriptionRateLimitError).isRetriable).toBe(true)
  })

  it('trata 5xx como retriável e 4xx de requisição como definitivo', async () => {
    const serverError = await transcriberWith(async () => new Response('boom', { status: 503 }))
      .transcribe({ buffer: Buffer.from('fake-ogg'), mimeType: OGG_OPUS })
      .catch((caught: unknown) => caught)

    const authError = await transcriberWith(async () => new Response('bad key', { status: 401 }))
      .transcribe({ buffer: Buffer.from('fake-ogg'), mimeType: OGG_OPUS })
      .catch((caught: unknown) => caught)

    expect(isTranscriptionError(serverError) && serverError.isRetriable).toBe(true)
    expect(isTranscriptionError(authError) && authError.isRetriable).toBe(false)
  })

  it('barra áudio acima do limite antes da rede — 413 contaria no rate limit', async () => {
    let called = false
    const transcriber = createGroqTranscriber({
      apiKey: 'test-key',
      maxBytes: 10,
      fetchImplementation: async () => {
        called = true
        return jsonResponse({ text: '' })
      },
    })

    await expect(transcriber.transcribe({ buffer: Buffer.alloc(11), mimeType: OGG_OPUS })).rejects.toThrow(
      /excede o limite/,
    )
    expect(called).toBe(false)
  })

  it('aceita texto vazio como resultado — silêncio não é falha', async () => {
    const transcriber = transcriberWith(async () => jsonResponse({ text: '' }))

    const result = await transcriber.transcribe({ buffer: Buffer.from('silence'), mimeType: OGG_OPUS })

    expect(result.text).toBe('')
  })

  it('converte falha de rede em erro retriável', async () => {
    const transcriber = transcriberWith(async () => {
      throw new Error('ECONNRESET')
    })

    const error = await transcriber
      .transcribe({ buffer: Buffer.from('fake-ogg'), mimeType: OGG_OPUS })
      .catch((caught: unknown) => caught)

    expect(isTranscriptionError(error) && error.isRetriable).toBe(true)
  })
})
