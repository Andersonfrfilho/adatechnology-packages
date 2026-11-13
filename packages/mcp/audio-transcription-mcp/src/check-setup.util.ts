/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O engine local depende de três coisas fora do processo: o binário do whisper.cpp, o ffmpeg e o
 * modelo ggml no disco. Quando uma falta, a transcrição falha lá na frente com mensagem de
 * subprocesso — e o cliente MCP mostra só isso. Esta checagem existe para responder "o que falta"
 * antes de alguém tentar adivinhar.
 */

import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// O whisper.cpp inicializa o backend de GPU antes de responder qualquer coisa — no Metal isso levou
// 8,4s numa máquina rápida, e o limite de 10s matava o processo e reportava ausência falsa.
const VERSION_TIMEOUT_MS = 30_000

export type SetupCheck = Readonly<{ name: string; ok: boolean; detail: string }>

export type CheckSetupParams = Readonly<{
  binaryPath: string
  ffmpegPath: string
  modelPath: string
}>

export async function checkSetup({ binaryPath, ffmpegPath, modelPath }: CheckSetupParams): Promise<readonly SetupCheck[]> {
  return Object.freeze(
    await Promise.all([
      checkBinary('whisper.cpp', binaryPath, ['--version']),
      checkBinary('ffmpeg', ffmpegPath, ['-version']),
      checkModel(modelPath),
    ]),
  )
}

// A pergunta é "o binário está aí", e só `ENOENT` responde não. Saída diferente de zero significa
// que ele executou e não gostou dos argumentos — o `whisper-cli --version` faz exatamente isso, e
// tratar isso como ausência dava um diagnóstico que contradizia a transcrição funcionando.
async function checkBinary(name: string, path: string, args: readonly string[]): Promise<SetupCheck> {
  try {
    await execFileAsync(path, [...args], { timeout: VERSION_TIMEOUT_MS })
    return Object.freeze({ name, ok: true, detail: `encontrado em "${path}"` })
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      return Object.freeze({ name, ok: false, detail: `não encontrado em "${path}"` })
    }

    return Object.freeze({ name, ok: true, detail: `encontrado em "${path}" (não respondeu a ${args.join(' ')})` })
  }
}

async function checkModel(modelPath: string): Promise<SetupCheck> {
  const stats = await stat(modelPath).catch(() => undefined)

  if (!stats?.isFile()) return Object.freeze({ name: 'modelo ggml', ok: false, detail: `não encontrado em "${modelPath}"` })

  const megabytes = Math.round(stats.size / 1024 / 1024)
  // O `large-v3-turbo` tem ~1.5GB. Um arquivo muito menor é modelo pequeno (que entra em loop de
  // repetição em pt-BR) ou download interrompido — nos dois casos vale avisar em vez de só aprovar.
  const isSuspiciouslySmall = megabytes < 400

  return Object.freeze({
    name: 'modelo ggml',
    ok: true,
    detail: isSuspiciouslySmall
      ? `${megabytes}MB em "${modelPath}" — pequeno demais para pt-BR confiável; prefira large-v3-turbo (~1.5GB)`
      : `${megabytes}MB em "${modelPath}"`,
  })
}
