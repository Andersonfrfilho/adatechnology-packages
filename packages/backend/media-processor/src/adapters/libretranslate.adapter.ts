// LibreTranslate Adapter - Free, open-source translation

import fetch from 'node-fetch';
import { Logger } from '@adatechnology/logger';
import { TranslationError, RateLimitError, CircuitBreakerOpenError } from '../errors/index.js';
import { RATE_LIMITS } from '../constants/index.js';

interface TranslationSegment {
  text: string;
  startTime: number;
  endTime: number;
}

interface TranslatedSegment extends TranslationSegment {
  translatedText: string;
}

/**
 * LibreTranslate Adapter - Uses open-source LibreTranslate
 *
 * Installation options:
 * 1. Docker: docker run -p 5000:5000 libretranslate/libretranslate
 * 2. Self-hosted: https://github.com/LibreTranslate/LibreTranslate
 * 3. Public API: https://libretranslate.de/api/translate (no auth required)
 *
 * Supports 30+ languages, completely free
 */
export class LibreTranslateAdapter {
  private apiUrl: string;
  private apiKey?: string;
  private logger: Logger;
  private requestQueue: Promise<any> = Promise.resolve();
  private lastRequestTime = 0;

  constructor(
    apiUrl: string = 'http://localhost:5000',
    apiKey: string | undefined = undefined,
    logger: Logger,
  ) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.logger = logger;
  }

  /**
   * Translate text from source to target language
   */
  async translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<string> {
    try {
      // Apply rate limiting (3 req/min = 20s between requests)
      await this.applyRateLimit();

      const payload = {
        q: text,
        source: this.normalizeLanguageCode(sourceLanguage),
        target: this.normalizeLanguageCode(targetLanguage),
        format: 'text',
        ...(this.apiKey && { api_key: this.apiKey }),
      };

      const response = await fetch(`${this.apiUrl}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new RateLimitError('LibreTranslate', 60);
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as any;

      if (!data.translatedText) {
        throw new Error('Invalid response: no translatedText');
      }

      this.logger.debug('[LibreTranslate] Translation completed', {
        sourceLanguage,
        targetLanguage,
        textLength: text.length,
      });

      return data.translatedText;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (error instanceof RateLimitError) {
        throw error;
      }

      this.logger.error('[LibreTranslate] Translation failed', {
        error: err.message,
        sourceLanguage,
        targetLanguage,
      });

      throw new TranslationError(`LibreTranslate error: ${err.message}`);
    }
  }

  /**
   * Translate multiple segments (batched for efficiency)
   */
  async translateSegments(
    segments: TranslationSegment[],
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<TranslatedSegment[]> {
    try {
      // Batch translate (send all at once, more efficient)
      const allText = segments.map(s => s.text).join('\n\n[SEGMENT_BREAK]\n\n');

      const translatedText = await this.translate(
        allText,
        sourceLanguage,
        targetLanguage,
      );

      // Split by our separator
      const translatedSegments = translatedText.split('\n\n[SEGMENT_BREAK]\n\n');

      if (translatedSegments.length !== segments.length) {
        this.logger.warn('[LibreTranslate] Segment count mismatch', {
          expected: segments.length,
          got: translatedSegments.length,
        });
      }

      return segments.map((segment, i) => ({
        ...segment,
        translatedText: translatedSegments[i] || segment.text,
      }));

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new TranslationError(`Batch translation failed: ${err.message}`);
    }
  }

  /**
   * Get supported languages
   */
  async getLanguages(): Promise<Array<{ code: string; name: string }>> {
    try {
      const response = await fetch(`${this.apiUrl}/languages`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as any;

      return data.languages || [];

    } catch (error) {
      this.logger.error('[LibreTranslate] Failed to fetch languages', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Return a sensible default if API fails
      return this.getDefaultLanguages();
    }
  }

  /**
   * Check if API is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/health`, {
        method: 'GET',
      });
      const isHealthy = response.ok;
      if (isHealthy) {
        this.logger.info('[LibreTranslate] Health check passed');
      } else {
        this.logger.warn('[LibreTranslate] Health check failed', {
          status: response.status,
        });
      }
      return isHealthy;
    } catch (error) {
      this.logger.error('[LibreTranslate] Health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Normalize language codes (pt-BR -> pt, es-ES -> es, etc)
   */
  private normalizeLanguageCode(code: string): string {
    return code.split('-')[0].toLowerCase();
  }

  /**
   * Rate limiting: 3 requests per minute
   */
  private async applyRateLimit(): Promise<void> {
    const minIntervalMs = (60 * 1000) / RATE_LIMITS.OPENAI_TRANSLATE; // ~12 seconds

    return new Promise((resolve) => {
      this.requestQueue = this.requestQueue.then(() => {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < minIntervalMs) {
          const delayMs = minIntervalMs - timeSinceLastRequest;
          return new Promise(r => {
            setTimeout(() => {
              this.lastRequestTime = Date.now();
              resolve();
              r(undefined);
            }, delayMs);
          });
        } else {
          this.lastRequestTime = now;
          resolve();
          return Promise.resolve();
        }
      });
    });
  }

  /**
   * Default languages (fallback if API fails)
   */
  private getDefaultLanguages(): Array<{ code: string; name: string }> {
    return [
      { code: 'pt', name: 'Portuguese' },
      { code: 'es', name: 'Spanish' },
      { code: 'en', name: 'English' },
      { code: 'fr', name: 'French' },
      { code: 'it', name: 'Italian' },
      { code: 'de', name: 'German' },
      { code: 'ru', name: 'Russian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ko', name: 'Korean' },
    ];
  }
}

/**
 * Installation instructions:
 *
 * Option 1: Docker (Recommended - easiest)
 * ```bash
 * docker run -p 5000:5000 libretranslate/libretranslate
 * ```
 * Environment variables:
 * - LIBRETRANSLATE_URL=http://localhost:5000
 *
 * Option 2: Docker Compose
 * ```yaml
 * services:
 *   libretranslate:
 *     image: libretranslate/libretranslate
 *     ports:
 *       - "5000:5000"
 *     environment:
 *       - REQ_LIMIT=200  # 200 requests per day (free tier)
 *       - LIB_PORT=5000
 * ```
 *
 * Option 3: Self-hosted Python
 * ```bash
 * git clone https://github.com/LibreTranslate/LibreTranslate.git
 * cd LibreTranslate
 * pip install -r requirements.txt
 * python main.py
 * ```
 *
 * Option 4: Use public API (no setup needed!)
 * ```typescript
 * const adapter = new LibreTranslateAdapter(
 *   'https://libretranslate.de',
 *   undefined,
 *   logger
 * );
 * ```
 *
 * Features:
 * - ✅ Completely free and open-source
 * - ✅ No API key required (unless self-hosted with auth)
 * - ✅ Supports 30+ languages
 * - ✅ Can run offline (on your own server)
 * - ✅ Fast (~0.5-1 second per request)
 * - ✅ Batch translation support
 * - ✅ No rate limiting on self-hosted version
 *
 * Quality: Good for general text, not perfect but acceptable for video subtitles
 * Alternative: Argos Translate (even more accurate, also free/open-source)
 */
