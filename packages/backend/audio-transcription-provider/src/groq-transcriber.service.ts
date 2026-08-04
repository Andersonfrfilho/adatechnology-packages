/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Transcrição via Groq (Whisper hospedado).
 *
 * Escolhido por aceitar OGG/Opus direto: é o formato que a Meta entrega nas notas de voz, e
 * qualquer engine que exija WAV arrasta ffmpeg para dentro da imagem do worker. Aqui não há
 * dependência de pacote nem binário — só `fetch`, `FormData` e `Blob` globais.
 *
 * A cobrança tem piso de 10 segundos por requisição: transcrever cem áudios de 2s custa o mesmo
 * que cem de 10s. Não muda nada no código, mas explica por que agrupar não vale a pena.
 */

import {
  DEFAULT_LANGUAGE_HINT,
  DEFAULT_TIMEOUT_MS,
  GROQ_BASE_URL,
  GROQ_DEFAULT_MAX_BYTES,
  GROQ_DEFAULT_MODEL,
  audioExtensionFor,
} from './audio-transcription.constant'
import {
  TranscriptionError,
  TranscriptionRateLimitError,
  TranscriptionUnsupportedError,
} from './audio-transcription.error'
import type {
  AudioTranscriber,
  GroqTranscriberConfig,
  TranscriptionInput,
  TranscriptionResult,
} from './audio-transcription.types'

const ENGINE_NAME = 'groq'

/** `verbose_json` em vez de `json`: é o único que devolve idioma detectado e duração. */
const RESPONSE_FORMAT = 'verbose_json'

type GroqVerboseResponse = {
  text?: unknown
  language?: unknown
  duration?: unknown
}

function parseRetryAfter(response: Response): number | undefined {
  const header = response.headers.get('retry-after')
  if (!header) return undefined
  const seconds = Number.parseInt(header, 10)
  return Number.isFinite(seconds) ? seconds : undefined
}

/**
 * 5xx e 408/409 são instabilidade do lado deles; 4xx restante é a requisição que está errada e vai
 * continuar errada. Insistir no segundo grupo só queima cota até o teto diário.
 */
function isRetriableStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 409
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.text()
    return body.slice(0, 500)
  } catch {
    return response.statusText
  }
}

export function createGroqTranscriber(config: GroqTranscriberConfig): AudioTranscriber {
  if (!config.apiKey) throw new TranscriptionError('apiKey do Groq é obrigatória.', ENGINE_NAME, false)

  const baseUrl = config.baseUrl ?? GROQ_BASE_URL
  const model = config.model ?? GROQ_DEFAULT_MODEL
  const maxBytes = config.maxBytes ?? GROQ_DEFAULT_MAX_BYTES
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const performFetch = config.fetchImplementation ?? ((url, init) => fetch(url, init))

  async function transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const extension = audioExtensionFor(input.mimeType)
    if (!extension) throw new TranscriptionUnsupportedError(ENGINE_NAME, input.mimeType)

    if (input.buffer.length > maxBytes) {
      throw new TranscriptionError(
        `Áudio de ${input.buffer.length} bytes excede o limite de ${maxBytes} do Groq.`,
        ENGINE_NAME,
        false,
      )
    }

    // Áudio vazio nunca chega à rede: a requisição voltaria 400 e ainda contaria no rate limit.
    if (input.buffer.length === 0) {
      throw new TranscriptionError('Áudio vazio.', ENGINE_NAME, false)
    }

    const form = new FormData()
    // Cópia explícita do recorte deste áudio. Um Buffer do Node costuma ser uma view sobre um pool
    // compartilhado, e passar `.buffer` para o Blob levaria o pool inteiro — bytes de outros
    // arquivos junto no multipart.
    const bytes = new Uint8Array(input.buffer)
    form.append('file', new Blob([bytes], { type: input.mimeType }), `audio.${extension}`)
    form.append('model', model)
    form.append('response_format', RESPONSE_FORMAT)
    // Determinismo: sem isso o mesmo áudio devolve texto ligeiramente diferente a cada chamada, e
    // uma retentativa depois de rate limit produziria transcrição divergente da primeira.
    form.append('temperature', '0')

    const languageHint = input.languageHint ?? config.languageHint ?? DEFAULT_LANGUAGE_HINT
    if (languageHint) form.append('language', languageHint)

    const response = await requestWithTimeout(form)

    if (response.status === 429) {
      throw new TranscriptionRateLimitError(ENGINE_NAME, parseRetryAfter(response))
    }

    if (!response.ok) {
      const detail = await readErrorMessage(response)
      // 400/415 com formato na tabela normalmente é o binário corrompido, não o codec — mas ambos
      // são definitivos, e a cadeia ainda tenta o engine seguinte.
      if (response.status === 400 || response.status === 415) {
        throw new TranscriptionUnsupportedError(ENGINE_NAME, input.mimeType, detail)
      }
      throw new TranscriptionError(
        `Groq respondeu ${response.status}: ${detail}`,
        ENGINE_NAME,
        isRetriableStatus(response.status),
        detail,
      )
    }

    return parseResult(await response.json())
  }

  async function requestWithTimeout(form: FormData): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await performFetch(`${baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${config.apiKey}` },
        body: form,
        signal: controller.signal,
      })
    } catch (error) {
      // Rede caiu ou o timeout abortou — os dois valem retentativa.
      throw new TranscriptionError(`Falha de rede ao chamar o Groq: ${String(error)}`, ENGINE_NAME, true, error)
    } finally {
      clearTimeout(timer)
    }
  }

  return Object.freeze({ name: ENGINE_NAME, transcribe })
}

function parseResult(payload: unknown): TranscriptionResult {
  const body = (payload ?? {}) as GroqVerboseResponse

  if (typeof body.text !== 'string') {
    throw new TranscriptionError('Resposta do Groq sem campo `text`.', ENGINE_NAME, true, payload)
  }

  // Texto vazio é resultado, não erro: áudio em silêncio ou só ruído transcreve para nada. Marcar
  // como falha faria o host reprocessar o mesmo silêncio a cada retentativa, para sempre.
  return Object.freeze({
    text: body.text.trim(),
    engine: ENGINE_NAME,
    ...(typeof body.language === 'string' ? { language: body.language } : {}),
    ...(typeof body.duration === 'number' ? { durationSeconds: body.duration } : {}),
  })
}
