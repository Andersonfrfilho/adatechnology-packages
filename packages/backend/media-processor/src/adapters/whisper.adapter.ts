// Whisper Adapter - Free speech-to-text (uses existing audio-transcription-provider)

import { readFile } from 'fs/promises'
import { AudioTranscriber, TranscriptionResult } from '@adatechnology/audio-transcription-provider'
import { Logger } from '@adatechnology/logger'
import { TranscriptionError, LanguageDetectionError } from '../errors/index.js'

/**
 * Whisper Adapter - Uses OpenAI's Whisper (free via audio-transcription-provider)
 *
 * Two options:
 * 1. Whisper Local (runs on your own GPU/CPU) - Completely free
 * 2. Groq API (free tier: 240 requests/day) - Faster but limited
 *
 * Both are handled by audio-transcription-provider which we already have
 */
export class WhisperAdapter {
  private transcriptionService: AudioTranscriber
  private logger: Logger

  constructor(transcriptionService: AudioTranscriber, logger: Logger) {
    this.transcriptionService = transcriptionService
    this.logger = logger
  }

  /**
   * Transcribe audio file to text with language detection
   */
  async transcribe(audioPath: string, mimeType = 'audio/wav'): Promise<TranscriptionResult> {
    try {
      this.logger.info('[Whisper] Starting transcription', { audioPath })

      const buffer = await readFile(audioPath)

      // Call the existing audio-transcription-provider
      const result = await this.transcriptionService.transcribe({ buffer, mimeType })

      if (!result.text) {
        throw new Error('Transcription returned empty text')
      }

      this.logger.info('[Whisper] Transcription completed', {
        language: result.language,
        engine: result.engine,
        textLength: result.text.length,
      })

      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.logger.error('[Whisper] Transcription failed', {
        error: err.message,
        audioPath,
      })
      throw new TranscriptionError(`Whisper transcription failed: ${err.message}`)
    }
  }

  /**
   * Detect language from audio
   */
  async detectLanguage(audioPath: string): Promise<{
    language: string
    languageName?: string
  }> {
    try {
      const result = await this.transcribe(audioPath)
      const language = result.language ?? ''

      // Map language codes to names
      const languageNames: Record<string, string> = {
        pt: 'Português',
        es: 'Español',
        en: 'English',
        fr: 'Français',
        it: 'Italiano',
        de: 'Deutsch',
        ru: 'Русский',
        ja: '日本語',
        zh: '中文',
        ko: '한국어',
      }

      return {
        language,
        languageName: languageNames[language] || language,
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.logger.error('[Whisper] Language detection failed', { error: err.message })
      throw new LanguageDetectionError(`Language detection failed: ${err.message}`)
    }
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): Array<{ code: string; name: string }> {
    return [
      { code: 'pt', name: 'Português (Brasil)' },
      { code: 'es', name: 'Español' },
      { code: 'en', name: 'English' },
      { code: 'fr', name: 'Français' },
      { code: 'it', name: 'Italiano' },
      { code: 'de', name: 'Deutsch' },
      { code: 'ru', name: 'Русский' },
      { code: 'ja', name: '日本語' },
      { code: 'zh', name: '中文 (Mandarin)' },
      { code: 'ko', name: '한국어' },
    ]
  }
}

/**
 * Setup Options:
 *
 * Option 1: Use existing audio-transcription-provider (Groq Free Tier)
 * - 240 requests/day for free
 * - Fastest (~0.5s per minute of audio)
 * - No setup needed, just API key
 *
 * Option 2: Whisper Local (if you have GPU)
 * ```python
 * pip install openai-whisper
 * ```
 *
 * Option 3: Whisper.cpp (optimized for CPU)
 * ```bash
 * git clone https://github.com/ggerganov/whisper.cpp
 * cd whisper.cpp
 * make
 * ./models/download-ggml-model.sh base
 * ./main -m models/ggml-base.bin audio.wav
 * ```
 *
 * We recommend: Groq Free Tier (240 req/day)
 * - No setup
 * - Super fast
 * - Completely free
 * - Already integrated via audio-transcription-provider
 *
 * For unlimited: Use Whisper Local with whisper.cpp
 * - Runs on your own machine
 * - Unlimited transcriptions
 * - Slower (~20-30s per minute of audio on CPU)
 */
