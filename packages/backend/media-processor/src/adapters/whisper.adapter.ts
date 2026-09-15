// Whisper Adapter - Free speech-to-text (uses existing audio-transcription-provider)

import { AudioTranscriptionService } from '@adatechnology/audio-transcription-provider';
import { Logger } from '@adatechnology/logger';
import { TranscriptionError, LanguageDetectionError } from '../errors/index.js';

interface WhisperResult {
  text: string;
  language: string;
  confidence: number;
  segments: {
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }[];
}

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
  private transcriptionService: AudioTranscriptionService;
  private logger: Logger;

  constructor(
    transcriptionService: AudioTranscriptionService,
    logger: Logger,
  ) {
    this.transcriptionService = transcriptionService;
    this.logger = logger;
  }

  /**
   * Transcribe audio file to text with language detection
   */
  async transcribe(audioPath: string): Promise<{
    text: string;
    language: string;
    languageConfidence: number;
    segments: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  }> {
    try {
      this.logger.info('[Whisper] Starting transcription', { audioPath });

      // Call the existing audio-transcription-provider
      const result = await this.transcriptionService.transcribe(audioPath) as WhisperResult;

      if (!result.text) {
        throw new Error('Transcription returned empty text');
      }

      // Convert segments to our format
      const segments = result.segments.map(seg => ({
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
      }));

      this.logger.info('[Whisper] Transcription completed', {
        language: result.language,
        confidence: result.confidence,
        segmentCount: segments.length,
        textLength: result.text.length,
      });

      return {
        text: result.text,
        language: result.language,
        languageConfidence: result.confidence,
        segments,
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('[Whisper] Transcription failed', {
        error: err.message,
        audioPath,
      });
      throw new TranscriptionError(`Whisper transcription failed: ${err.message}`);
    }
  }

  /**
   * Detect language from audio
   */
  async detectLanguage(audioPath: string): Promise<{
    language: string;
    confidence: number;
    languageName?: string;
  }> {
    try {
      const result = await this.transcribe(audioPath);

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
      };

      return {
        language: result.language,
        confidence: result.languageConfidence,
        languageName: languageNames[result.language] || result.language,
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('[Whisper] Language detection failed', { error: err.message });
      throw new LanguageDetectionError(`Language detection failed: ${err.message}`);
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
    ];
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
