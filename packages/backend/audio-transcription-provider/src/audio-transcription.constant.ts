/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'

/**
 * `turbo` e não `whisper-large-v3` puro: mesma família de qualidade em pt-BR por uma fração do
 * custo por hora, e a diferença de acurácia não aparece em nota de voz de trinta segundos.
 */
export const GROQ_DEFAULT_MODEL = 'whisper-large-v3-turbo'

/** Teto do free tier. O dev tier aceita 100MB; nota de voz do WhatsApp não passa de 16MB. */
export const GROQ_DEFAULT_MAX_BYTES = 25 * 1024 * 1024

export const DEFAULT_TIMEOUT_MS = 120_000

export const DEFAULT_LANGUAGE_HINT = 'pt'

/**
 * O que a API do Groq aceita, por extensão. A chave é o mime; o valor é a extensão que precisa ir
 * no nome do arquivo no multipart — o serviço decide o decoder pelo sufixo, não pelo Content-Type,
 * então mandar `blob` sem extensão faz um OGG válido voltar como 400.
 *
 * AMR e AAC ficam fora porque o Groq realmente não os aceita: o WhatsApp entrega nota de voz em
 * OGG/Opus, mas um arquivo de áudio anexado pelo cliente pode chegar em qualquer coisa. Mime fora
 * desta tabela vira `TranscriptionUnsupportedError`, que a cadeia repassa a um engine com ffmpeg.
 */
export const GROQ_SUPPORTED_AUDIO_EXTENSIONS: Readonly<Record<string, string>> = Object.freeze({
  'audio/flac': 'flac',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mpga': 'mpga',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/vorbis': 'ogg',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'video/mp4': 'mp4',
  'video/mpeg': 'mpeg',
  'video/webm': 'webm',
})

/**
 * Normaliza o mime para a chave da tabela. `audio/ogg; codecs=opus` é exatamente o que a Meta
 * manda, e comparar a string inteira não casaria com nada.
 */
export function normalizeMimeType(mimeType: string): string {
  return (mimeType.split(';')[0] ?? '').trim().toLowerCase()
}

export function audioExtensionFor(mimeType: string): string | undefined {
  return GROQ_SUPPORTED_AUDIO_EXTENSIONS[normalizeMimeType(mimeType)]
}
