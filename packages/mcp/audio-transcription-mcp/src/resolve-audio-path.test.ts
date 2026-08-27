/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { mimeTypeFor, parseEnvironment } from './audio-transcription-mcp.constant'
import { resolveAudioPath } from './resolve-audio-path.util'

async function fixtureDirectory(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'mcp-audio-'))
}

describe('resolveAudioPath', () => {
  it('devolve o caminho quando o arquivo existe dentro da raiz permitida', async () => {
    const root = await fixtureDirectory()
    const filePath = join(root, 'nota.m4a')
    await writeFile(filePath, 'conteudo')

    expect(await resolveAudioPath({ filePath, allowedRoot: root })).toBe(filePath)
  })

  it('recusa caminho fora da raiz permitida, inclusive por travessia com ..', async () => {
    const root = await fixtureDirectory()
    const escaping = join(root, '..', 'outro.m4a')

    await expect(resolveAudioPath({ filePath: escaping, allowedRoot: root })).rejects.toThrow(/fora da pasta permitida/)
  })

  it('não deixa raiz vizinha de prefixo igual passar por dentro', async () => {
    const base = await fixtureDirectory()
    const root = join(base, 'audios')
    const sibling = join(base, 'audios-privados', 'x.m4a')

    await expect(resolveAudioPath({ filePath: sibling, allowedRoot: root })).rejects.toThrow(/fora da pasta permitida/)
  })

  it('exige caminho absoluto', async () => {
    await expect(resolveAudioPath({ filePath: 'relativo.m4a' })).rejects.toThrow(/caminho absoluto/i)
  })

  it('recusa arquivo inexistente e arquivo vazio', async () => {
    const root = await fixtureDirectory()
    const empty = join(root, 'vazio.m4a')
    await writeFile(empty, '')

    await expect(resolveAudioPath({ filePath: join(root, 'sumiu.m4a') })).rejects.toThrow(/não encontrado/)
    await expect(resolveAudioPath({ filePath: empty })).rejects.toThrow(/vazio/)
  })
})

describe('parseEnvironment', () => {
  it('nomeia a variável que falta em vez de falhar genericamente', () => {
    expect(() => parseEnvironment({})).toThrow(/WHISPER_MODEL_PATH/)
  })

  it('preenche os padrões de binário e idioma', () => {
    const environment = parseEnvironment({ WHISPER_MODEL_PATH: '/models/ggml.bin' })

    expect(environment.WHISPER_BINARY_PATH).toBe('whisper-cli')
    expect(environment.FFMPEG_PATH).toBe('ffmpeg')
    expect(environment.TRANSCRIPTION_LANGUAGE).toBe('pt')
  })
})

describe('mimeTypeFor', () => {
  it('deriva o mime da extensão e cai em octet-stream no desconhecido', () => {
    expect(mimeTypeFor('/a/b/nota.m4a')).toBe('audio/mp4')
    expect(mimeTypeFor('/a/b/NOTA.OGG')).toBe('audio/ogg')
    expect(mimeTypeFor('/a/b/gravacao.xyz')).toBe('application/octet-stream')
  })
})
