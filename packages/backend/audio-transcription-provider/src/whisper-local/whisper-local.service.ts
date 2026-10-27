/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Transcrição local via whisper.cpp — a reserva para o dia em que depender de um serviço externo
 * deixar de ser aceitável (cota apertada, mudança de política, exigência de não enviar áudio para
 * fora).
 *
 * **Export separado, e não parte do `index`, de propósito.** Este arquivo importa `node:child_process`
 * e `node:fs`, e exige duas coisas na imagem que o engine hospedado não exige: o binário do
 * whisper.cpp e o ffmpeg. Deixá-lo no barril principal faria todo consumidor carregar essa
 * bagagem para usar só o Groq. Importe de `@adatechnology/audio-transcription-provider/whisper-local`
 * quando for ligar.
 *
 * Para ligar num Dockerfile Alpine (o caso do worker do QuickCart):
 *
 * ```dockerfile
 * RUN apk add --no-cache ffmpeg
 * # whisper.cpp: compile no estágio de build e copie só o binário + modelo para o runner
 * RUN apk add --no-cache --virtual .whisper-build build-base cmake git \
 *   && git clone --depth 1 https://github.com/ggml-org/whisper.cpp /tmp/whisper \
 *   && cmake -S /tmp/whisper -B /tmp/whisper/build -DCMAKE_BUILD_TYPE=Release \
 *   && cmake --build /tmp/whisper/build --target whisper-cli -j"$(nproc)" \
 *   && install -m 0755 /tmp/whisper/build/bin/whisper-cli /usr/local/bin/whisper-cli \
 *   && /tmp/whisper/models/download-ggml-model.sh large-v3-turbo /models \
 *   && rm -rf /tmp/whisper && apk del .whisper-build
 * ```
 *
 * **Use `large-v3-turbo` (~1.6GB).** Os modelos menores não erram só "um pouco mais" em pt-BR: eles
 * trocam palavras e entram em loop de repetição em áudio de celular, e o resultado não é uma
 * transcrição pior, é uma transcrição inútil. O turbo tem só 4 camadas de decoder, então entrega
 * qualidade de `large` sem o custo dele. `small` (~488MB) segue aceitável onde a memória da imagem
 * for o limite; `base` (~148MB) não vale a economia.
 *
 * Referência medida: áudio de reunião de 7min38s gravado por celular transcreveu em 61,9s (com a
 * conversão ffmpeg) em Apple M3 Pro com Metal, sem loop de repetição. Em CPU de container é bem
 * mais lento — meça no runner de destino antes de dimensionar a fila.
 */

import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { DEFAULT_LANGUAGE_HINT, audioExtensionFor } from '../audio-transcription.constant'
import { collapseRepetitions } from '../collapse-repetitions.util'
import { TranscriptionError } from '../audio-transcription.error'
import type {
  AudioTranscriber,
  TranscriptionInput,
  TranscriptionResult,
  WhisperLocalTranscriberConfig,
} from '../audio-transcription.types'

const execFileAsync = promisify(execFile)

const ENGINE_NAME = 'whisper-local'

/** O whisper.cpp aceita exclusivamente WAV PCM 16 bits, 16kHz, mono. Não é preferência, é requisito. */
const TARGET_SAMPLE_RATE = '16000'
const TARGET_CHANNELS = '1'

/** Inferência em CPU é lenta por natureza; 10 minutos cobre áudio longo com `large-v3-turbo`. */
const DEFAULT_LOCAL_TIMEOUT_MS = 600_000

const STDOUT_MAX_BYTES = 32 * 1024 * 1024

export function createWhisperLocalTranscriber(config: WhisperLocalTranscriberConfig): AudioTranscriber {
  if (!config.modelPath) throw new TranscriptionError('modelPath é obrigatório.', ENGINE_NAME, false)

  const binaryPath = config.binaryPath ?? 'whisper-cli'
  const ffmpegPath = config.ffmpegPath ?? 'ffmpeg'
  const timeoutMs = config.timeoutMs ?? DEFAULT_LOCAL_TIMEOUT_MS

  async function transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    if (input.buffer.length === 0) throw new TranscriptionError('Áudio vazio.', ENGINE_NAME, false)

    // Extensão só como dica ao ffmpeg — ele detecta pelo conteúdo, então mime desconhecido aqui
    // não é motivo para recusar: é justamente o caso (AMR, AAC) que este engine cobre e o Groq não.
    const extension = audioExtensionFor(input.mimeType) ?? 'bin'
    const workDirectory = await mkdtemp(join(tmpdir(), 'whisper-local-'))

    try {
      const sourcePath = join(workDirectory, `source.${extension}`)
      const wavPath = join(workDirectory, 'source.wav')
      await writeFile(sourcePath, input.buffer)

      await convertToWav(sourcePath, wavPath)

      return await runWhisper(wavPath, input.languageHint)
    } finally {
      // `force` porque o diretório pode nem ter sido preenchido se o ffmpeg falhou de saída, e
      // deixar temporário para trás em worker de longa vida enche o disco em silêncio.
      await rm(workDirectory, { recursive: true, force: true })
    }
  }

  async function convertToWav(sourcePath: string, wavPath: string): Promise<void> {
    try {
      await execFileAsync(
        ffmpegPath,
        [
          '-nostdin',
          '-loglevel',
          'error',
          '-i',
          sourcePath,
          '-ar',
          TARGET_SAMPLE_RATE,
          '-ac',
          TARGET_CHANNELS,
          '-y',
          wavPath,
        ],
        { timeout: timeoutMs, maxBuffer: STDOUT_MAX_BYTES },
      )
    } catch (error) {
      // Binário ausente é configuração errada (definitivo); o resto é o áudio que não decodifica.
      const isMissingBinary = (error as { code?: string }).code === 'ENOENT'
      throw new TranscriptionError(
        isMissingBinary
          ? `ffmpeg não encontrado em "${ffmpegPath}" — o engine local exige ffmpeg na imagem.`
          : `Falha ao converter áudio para WAV: ${String(error)}`,
        ENGINE_NAME,
        false,
        error,
      )
    }
  }

  async function runWhisper(wavPath: string, languageHint?: string): Promise<TranscriptionResult> {
    const language = languageHint ?? config.languageHint ?? DEFAULT_LANGUAGE_HINT
    const args = [
      '--model',
      config.modelPath,
      '--file',
      wavPath,
      // Sem timestamps: o que este pacote devolve é texto corrido, e as marcações teriam de ser
      // removidas depois de qualquer forma.
      '--no-timestamps',
      '--language',
      language,
      // Saída para arquivo em vez de stdout — o whisper.cpp mistura progresso e log no stdout, e
      // separar isso por heurística de string quebra a cada versão do binário.
      // Cada janela de 30s decodifica sozinha, sem receber o texto da anterior como prompt. É o
      // carregamento desse contexto que alimenta o loop de repetição: uma frase repetida entra no
      // prompt da janela seguinte e se confirma. Custa um pouco de coerência entre janelas e evita
      // o modo de falha que torna a transcrição inútil.
      '--max-context',
      '0',
      '--output-txt',
      '--output-file',
      wavPath,
    ]
    if (config.threads) args.push('--threads', String(config.threads))

    try {
      await execFileAsync(binaryPath, args, { timeout: timeoutMs, maxBuffer: STDOUT_MAX_BYTES })
    } catch (error) {
      const isMissingBinary = (error as { code?: string }).code === 'ENOENT'
      throw new TranscriptionError(
        isMissingBinary ? `whisper.cpp não encontrado em "${binaryPath}".` : `whisper.cpp falhou: ${String(error)}`,
        ENGINE_NAME,
        // Falha de execução (OOM, timeout, processo morto por pressão de memória) merece
        // retentativa; binário ausente não melhora tentando de novo.
        !isMissingBinary,
        error,
      )
    }

    const text = await readTranscript(`${wavPath}.txt`)

    return Object.freeze({ text, engine: ENGINE_NAME, language })
  }

  async function readTranscript(path: string): Promise<string> {
    try {
      return collapseRepetitions(await readFile(path, 'utf8'))
    } catch (error) {
      throw new TranscriptionError('whisper.cpp terminou sem produzir transcrição.', ENGINE_NAME, true, error)
    }
  }

  return Object.freeze({ name: ENGINE_NAME, transcribe })
}
