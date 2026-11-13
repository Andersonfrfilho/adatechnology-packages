/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Servidor MCP sobre o engine local do `@adatechnology/audio-transcription-provider`.
 *
 * O ganho é a ausência de conta: nenhuma chave de API, nenhum upload, nenhum custo por minuto — o
 * áudio não sai da máquina. Em troca, exige whisper.cpp, ffmpeg e o modelo ggml instalados, e é por
 * isso que a ferramenta de diagnóstico faz parte da superfície e não é um extra.
 */

import { readFile } from 'node:fs/promises'

import { createWhisperLocalTranscriber } from '@adatechnology/audio-transcription-provider/whisper-local'
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import {
  SERVER_NAME,
  SERVER_VERSION,
  type ServerEnvironment,
  mimeTypeFor,
} from './audio-transcription-mcp.constant'
import { checkSetup } from './check-setup.util'
import { resolveAudioPath } from './resolve-audio-path.util'

export function createTranscriptionMcpServer(environment: ServerEnvironment): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION })

  const transcriber = createWhisperLocalTranscriber({
    modelPath: environment.WHISPER_MODEL_PATH,
    binaryPath: environment.WHISPER_BINARY_PATH,
    ffmpegPath: environment.FFMPEG_PATH,
    languageHint: environment.TRANSCRIPTION_LANGUAGE,
    ...(environment.WHISPER_THREADS ? { threads: environment.WHISPER_THREADS } : {}),
  })

  server.registerTool(
    'transcribe_audio',
    {
      description:
        'Transcreve um arquivo de áudio local para texto usando Whisper (whisper.cpp) na própria máquina. ' +
        'Sem chave de API e sem enviar o áudio para fora. Aceita m4a, mp3, ogg/opus, wav, flac, webm, amr e aac.',
      inputSchema: z.object({
        filePath: z.string().describe('Caminho absoluto do arquivo de áudio na máquina que roda o servidor'),
        languageHint: z
          .string()
          .optional()
          .describe("Idioma falado em ISO 639-1 (ex: 'pt', 'en'). Padrão: o configurado no servidor"),
      }),
    },
    async ({ filePath, languageHint }) => {
      const resolvedPath = await resolveAudioPath({
        filePath,
        ...(environment.TRANSCRIPTION_ALLOWED_ROOT ? { allowedRoot: environment.TRANSCRIPTION_ALLOWED_ROOT } : {}),
      })

      const result = await transcriber.transcribe({
        buffer: await readFile(resolvedPath),
        mimeType: mimeTypeFor(resolvedPath),
        ...(languageHint ? { languageHint } : {}),
      })

      // Texto vazio é resultado legítimo (áudio em silêncio). Devolver string vazia deixaria o
      // cliente sem saber se transcreveu nada ou se a ferramenta quebrou.
      return {
        content: [{ type: 'text' as const, text: result.text || '(áudio sem fala detectável)' }],
      }
    },
  )

  server.registerTool(
    'check_transcription_setup',
    {
      description:
        'Verifica se o whisper.cpp, o ffmpeg e o modelo ggml estão disponíveis para o servidor. ' +
        'Use quando transcribe_audio falhar, antes de investigar o áudio.',
      inputSchema: z.object({}),
    },
    async () => {
      const checks = await checkSetup({
        binaryPath: environment.WHISPER_BINARY_PATH,
        ffmpegPath: environment.FFMPEG_PATH,
        modelPath: environment.WHISPER_MODEL_PATH,
      })

      const lines = checks.map((check) => `${check.ok ? '✅' : '❌'} ${check.name}: ${check.detail}`)
      const isReady = checks.every((check) => check.ok)

      return {
        content: [
          {
            type: 'text' as const,
            text: [isReady ? 'Pronto para transcrever.' : 'Faltam pré-requisitos:', ...lines].join('\n'),
          },
        ],
      }
    },
  )

  return server
}
