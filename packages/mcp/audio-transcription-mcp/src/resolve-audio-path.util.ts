/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O caminho do arquivo vem do modelo, não de uma pessoa digitando. Tratá-lo como entrada de
 * fronteira é o mínimo: resolver antes de comparar (senão `../` passa), e recusar o que estiver
 * fora da raiz permitida quando houver uma.
 */

import { stat } from 'node:fs/promises'
import { isAbsolute, resolve, sep } from 'node:path'

import { MAX_AUDIO_BYTES } from './audio-transcription-mcp.constant'

export type ResolveAudioPathParams = Readonly<{
  filePath: string
  allowedRoot?: string
}>

export async function resolveAudioPath({ filePath, allowedRoot }: ResolveAudioPathParams): Promise<string> {
  if (!isAbsolute(filePath)) {
    throw new Error(`Informe o caminho absoluto do áudio — recebido "${filePath}".`)
  }

  const resolvedPath = resolve(filePath)

  if (allowedRoot) {
    const resolvedRoot = resolve(allowedRoot)
    // O `sep` no fim impede que `/audios-privados` case com a raiz `/audios`.
    const isInsideRoot = resolvedPath === resolvedRoot || resolvedPath.startsWith(resolvedRoot + sep)
    if (!isInsideRoot) throw new Error(`Caminho fora da pasta permitida (${resolvedRoot}).`)
  }

  const stats = await stat(resolvedPath).catch(() => undefined)

  if (!stats) throw new Error(`Arquivo não encontrado: ${resolvedPath}`)
  if (!stats.isFile()) throw new Error(`Não é um arquivo: ${resolvedPath}`)
  if (stats.size === 0) throw new Error(`Arquivo vazio: ${resolvedPath}`)
  if (stats.size > MAX_AUDIO_BYTES) {
    throw new Error(`Arquivo de ${Math.round(stats.size / 1024 / 1024)}MB excede o limite de ${MAX_AUDIO_BYTES / 1024 / 1024}MB.`)
  }

  return resolvedPath
}
