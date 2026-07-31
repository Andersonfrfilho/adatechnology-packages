/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export { createGroqTranscriber } from './groq-transcriber.service'
export { createTranscriberChain } from './transcriber-chain.service'
export type { TranscriberChainConfig } from './transcriber-chain.service'

export {
  GROQ_BASE_URL,
  GROQ_DEFAULT_MAX_BYTES,
  GROQ_DEFAULT_MODEL,
  GROQ_SUPPORTED_AUDIO_EXTENSIONS,
  audioExtensionFor,
  normalizeMimeType,
} from './audio-transcription.constant'

export {
  TranscriptionError,
  TranscriptionRateLimitError,
  TranscriptionUnsupportedError,
  isRetriableTranscriptionFailure,
  isTranscriptionError,
} from './audio-transcription.error'

export type {
  AudioTranscriber,
  FetchImplementation,
  GroqTranscriberConfig,
  TranscriptionInput,
  TranscriptionResult,
  WhisperLocalTranscriberConfig,
} from './audio-transcription.types'
