/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Configuração do servidor, validada no boot.
 *
 * Um servidor MCP falha em silêncio quando a configuração está errada: o cliente só vê a ferramenta
 * devolver erro, sem pista de qual variável faltou. Validar aqui, com mensagem nomeando a variável,
 * transforma isso num erro de inicialização que aparece no log do cliente MCP.
 */

import { z } from 'zod'

export const SERVER_NAME = 'ada-audio-transcription'
export const SERVER_VERSION = '0.1.0-rc.1'

export const DEFAULT_LANGUAGE = 'pt'

/** Áudio maior que isto quase sempre é engano de caminho (vídeo, dump); o limite dá erro claro. */
export const MAX_AUDIO_BYTES = 512 * 1024 * 1024

/**
 * O engine local só precisa da extensão como dica ao ffmpeg — ele detecta o formato pelo conteúdo.
 * Por isso o mapa não precisa ser exaustivo: o que não estiver aqui vira `application/octet-stream`
 * e continua funcionando.
 */
export const MIME_BY_EXTENSION = Object.freeze({
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  webm: 'audio/webm',
  amr: 'audio/amr',
  aac: 'audio/aac',
}) as Readonly<Record<string, string>>

const environmentSchema = z.object({
  WHISPER_MODEL_PATH: z.string().min(1, 'WHISPER_MODEL_PATH é obrigatório (caminho do modelo ggml).'),
  WHISPER_BINARY_PATH: z.string().min(1).default('whisper-cli'),
  FFMPEG_PATH: z.string().min(1).default('ffmpeg'),
  WHISPER_THREADS: z.coerce.number().int().positive().optional(),
  TRANSCRIPTION_LANGUAGE: z.string().min(2).default(DEFAULT_LANGUAGE),
  /**
   * Sem isto o servidor lê qualquer arquivo que o usuário do processo conseguir ler, e quem manda o
   * caminho é o modelo. Num servidor local isso costuma ser aceitável; apontar para uma pasta de
   * áudios torna aceitável sempre.
   */
  TRANSCRIPTION_ALLOWED_ROOT: z.string().min(1).optional(),
})

export type ServerEnvironment = z.infer<typeof environmentSchema>

export function parseEnvironment(source: NodeJS.ProcessEnv): ServerEnvironment {
  const parsed = environmentSchema.safeParse(source)

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new Error(`Configuração inválida do ${SERVER_NAME} — ${details}`)
  }

  return Object.freeze(parsed.data)
}

export function mimeTypeFor(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase() ?? ''

  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream'
}
