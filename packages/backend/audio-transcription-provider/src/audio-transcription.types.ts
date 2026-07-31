/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type TranscriptionInput = Readonly<{
  buffer: Buffer
  /** Mime do binário como veio do canal — `audio/ogg; codecs=opus` nas notas de voz do WhatsApp. */
  mimeType: string
  /**
   * ISO 639-1 esperado. Não é filtro, é dica: informar o idioma corta a etapa de detecção do
   * Whisper, o que reduz latência e evita a falha clássica de transcrever pt-BR curto como espanhol.
   */
  languageHint?: string
}>

export type TranscriptionResult = Readonly<{
  /** Vazio é resultado legítimo (áudio em silêncio), não falha — ver `createGroqTranscriber`. */
  text: string
  /** ISO 639-1 detectado, quando o engine informa. */
  language?: string
  /** Duração segundo o engine. Serve a custo e telemetria, não a exibição. */
  durationSeconds?: number
  /** Quem produziu. Numa cadeia de engines é a única forma de saber qual respondeu. */
  engine: string
}>

/**
 * A porta que o consumidor injeta. Estrutural de propósito: qualquer objeto com `name` e
 * `transcribe` serve, então o host pode passar um mock nos testes sem importar este pacote.
 */
export type AudioTranscriber = Readonly<{
  name: string
  transcribe: (input: TranscriptionInput) => Promise<TranscriptionResult>
}>

/** Subconjunto de `fetch` que o provider usa — injetável para teste sem rede. */
export type FetchImplementation = (url: string, init: RequestInit) => Promise<Response>

export type GroqTranscriberConfig = Readonly<{
  apiKey: string
  /** Padrão `whisper-large-v3-turbo`: melhor relação custo/qualidade em pt-BR do catálogo. */
  model?: string
  baseUrl?: string
  languageHint?: string
  /**
   * Teto local, antes de gastar a requisição. O free tier recusa acima de 25MB e o dev tier acima
   * de 100MB; barrar aqui transforma um 413 (que conta no rate limit) num erro imediato e barato.
   */
  maxBytes?: number
  timeoutMs?: number
  fetchImplementation?: FetchImplementation
}>

export type WhisperLocalTranscriberConfig = Readonly<{
  /** Caminho do modelo ggml (ex.: `/models/ggml-small.bin`). Sem modelo o whisper.cpp não sobe. */
  modelPath: string
  /** Binário do whisper.cpp. Padrão `whisper-cli`, o nome atual do executável. */
  binaryPath?: string
  /**
   * O whisper.cpp só lê WAV PCM 16kHz mono, e a Meta entrega OGG/Opus — logo o ffmpeg não é
   * opcional aqui, é parte do caminho crítico.
   */
  ffmpegPath?: string
  threads?: number
  languageHint?: string
  /**
   * Inferência em CPU não tem teto natural: um áudio longo com modelo grande prende o processo
   * indefinidamente. O timeout é o que impede um único áudio de travar o worker.
   */
  timeoutMs?: number
}>
