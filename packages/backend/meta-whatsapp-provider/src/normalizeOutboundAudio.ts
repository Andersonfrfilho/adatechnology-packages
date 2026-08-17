import { spawn } from 'node:child_process'

import { WhatsAppAudioTranscodeError } from '@adatechnology/meta-graph-core'

import { detectAudioContainer, isAcceptedByWhatsApp } from './audioContainer'

export const OPUS_MIME_TYPE = 'audio/ogg; codecs=opus'

const TRANSCODE_TIMEOUT_MILLISECONDS = 30_000

export type AudioTranscoder = (buffer: Buffer) => Promise<Buffer>

export type NormalizeOutboundAudioParams = {
  readonly buffer: Buffer
  readonly mimeType: string
  readonly filename: string
  readonly transcoder?: AudioTranscoder
}

export type NormalizedOutboundAudio = {
  readonly buffer: Buffer
  readonly mimeType: string
  readonly filename: string
}

function replaceExtension(filename: string, extension: string): string {
  const lastDotIndex = filename.lastIndexOf('.')
  const base = lastDotIndex > 0 ? filename.slice(0, lastDotIndex) : filename
  return `${base}.${extension}`
}

/**
 * Converte o áudio para ogg/opus com ffmpeg lendo e escrevendo por pipe — sem arquivo temporário,
 * que exigiria um diretório gravável e limpeza em caso de falha.
 */
export function createFfmpegTranscoder(ffmpegPath = process.env['FFMPEG_PATH'] ?? 'ffmpeg'): AudioTranscoder {
  return (buffer) =>
    new Promise<Buffer>((resolve, reject) => {
      const ffmpeg = spawn(ffmpegPath, [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        'pipe:0',
        '-vn',
        '-c:a',
        'libopus',
        '-b:a',
        '32k',
        '-ar',
        '48000',
        '-ac',
        '1',
        '-f',
        'ogg',
        'pipe:1',
      ])

      const outputChunks: Buffer[] = []
      const errorChunks: Buffer[] = []
      const timeout = setTimeout(() => {
        ffmpeg.kill('SIGKILL')
        reject(new WhatsAppAudioTranscodeError(`ffmpeg excedeu ${TRANSCODE_TIMEOUT_MILLISECONDS}ms`))
      }, TRANSCODE_TIMEOUT_MILLISECONDS)

      ffmpeg.stdout.on('data', (chunk: Buffer) => outputChunks.push(chunk))
      ffmpeg.stderr.on('data', (chunk: Buffer) => errorChunks.push(chunk))

      ffmpeg.on('error', (error) => {
        clearTimeout(timeout)
        const reason =
          (error as NodeJS.ErrnoException).code === 'ENOENT'
            ? `ffmpeg não encontrado em "${ffmpegPath}" — instale-o na imagem ou informe ffmpegPath`
            : error.message
        reject(new WhatsAppAudioTranscodeError(reason))
      })

      ffmpeg.on('close', (exitCode) => {
        clearTimeout(timeout)
        if (exitCode !== 0) {
          reject(
            new WhatsAppAudioTranscodeError(
              Buffer.concat(errorChunks).toString('utf8').trim() || `ffmpeg saiu com código ${exitCode}`,
            ),
          )
          return
        }
        const output = Buffer.concat(outputChunks)
        if (output.byteLength === 0) {
          reject(new WhatsAppAudioTranscodeError('ffmpeg não produziu áudio'))
          return
        }
        resolve(output)
      })

      // O stdin fecha com o buffer inteiro; EPIPE aqui significa que o ffmpeg já morreu, e o
      // erro real vem pelo 'close'.
      ffmpeg.stdin.on('error', () => {})
      ffmpeg.stdin.end(buffer)
    })
}

/**
 * Garante que o áudio de saída esteja num container que a Meta aceita. Áudio que já chega em
 * formato aceito passa intacto; o resto vira ogg/opus, que além de aceito é o formato que o
 * WhatsApp renderiza como mensagem de voz.
 */
export async function normalizeOutboundAudio({
  buffer,
  mimeType,
  filename,
  transcoder,
}: NormalizeOutboundAudioParams): Promise<NormalizedOutboundAudio> {
  if (!mimeType.startsWith('audio/')) return { buffer, mimeType, filename }
  if (isAcceptedByWhatsApp(detectAudioContainer(buffer))) return { buffer, mimeType, filename }

  const transcoded = await (transcoder ?? createFfmpegTranscoder())(buffer)

  return {
    buffer: transcoded,
    mimeType: OPUS_MIME_TYPE,
    filename: replaceExtension(filename, 'ogg'),
  }
}
