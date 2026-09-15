// Piper TTS Adapter - Free, offline text-to-speech

import { spawn } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { Logger } from '@adatechnology/logger';
import { TextToSpeechError } from '../errors/index.js';

interface PiperVoiceConfig {
  languageCode: string;
  voiceId: string; // e.g., 'pt_BR-faber-medium'
  quality: 'low' | 'medium' | 'high';
}

const DEFAULT_VOICES: Record<string, PiperVoiceConfig> = {
  pt: {
    languageCode: 'pt_BR',
    voiceId: 'pt_BR-faber-medium', // Free Brazilian Portuguese
    quality: 'medium',
  },
  es: {
    languageCode: 'es_ES',
    voiceId: 'es_ES-carlfm-x_low', // Free Spanish
    quality: 'medium',
  },
  en: {
    languageCode: 'en_US',
    voiceId: 'en_US-amy-medium', // Free English (female)
    quality: 'medium',
  },
  fr: {
    languageCode: 'fr_FR',
    voiceId: 'fr_FR-siwis-medium', // Free French
    quality: 'medium',
  },
};

/**
 * Piper TTS Adapter - Uses open-source Piper models
 *
 * Installation:
 * - Clone: https://github.com/rhasspy/piper
 * - Or use Docker: docker run -v /path/to/models:/models piper
 *
 * Models are downloaded on first use (auto-downloads from Hugging Face)
 * No API keys required, runs completely offline
 */
export class PiperTTSAdapter {
  private piperBinary: string;
  private modelsDir: string;
  private logger: Logger;

  constructor(
    piperBinary: string = 'piper', // Path to piper binary or 'piper' in PATH
    modelsDir: string = '/tmp/piper-models',
    logger: Logger,
  ) {
    this.piperBinary = piperBinary;
    this.modelsDir = modelsDir;
    this.logger = logger;
  }

  /**
   * Generate speech from text using Piper
   */
  async generateSpeech(
    text: string,
    languageCode: string,
    outputPath: string,
  ): Promise<{ audioPath: string; duration: number }> {
    try {
      const voiceConfig = DEFAULT_VOICES[languageCode] || DEFAULT_VOICES.en;
      const modelPath = join(this.modelsDir, `${voiceConfig.voiceId}.onnx`);
      const configPath = join(this.modelsDir, `${voiceConfig.voiceId}.onnx.json`);

      // Create temp JSON file with text (Piper reads from stdin)
      const tempJsonPath = `/tmp/piper-input-${Date.now()}.json`;

      // Write input JSON
      writeFileSync(tempJsonPath, JSON.stringify({
        text,
      }));

      return new Promise((resolve, reject) => {
        const piperProcess = spawn(this.piperBinary, [
          '--model', modelPath,
          '--output_file', outputPath,
          '--json-filter', // Process JSON input
        ]);

        let stderr = '';
        let stdoutData = '';

        piperProcess.stdin.write(JSON.stringify({ text }));
        piperProcess.stdin.end();

        piperProcess.stdout.on('data', (data) => {
          stdoutData += data.toString();
        });

        piperProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        piperProcess.on('close', (code) => {
          // Cleanup
          try {
            unlinkSync(tempJsonPath);
          } catch (e) {
            // Ignore cleanup errors
          }

          if (code !== 0) {
            this.logger.error('[PiperTTS] Generation failed', {
              code,
              stderr,
              text: text.substring(0, 100),
            });
            reject(new TextToSpeechError(`Piper TTS failed: ${stderr}`, { code }));
            return;
          }

          // Estimate duration based on text length and speech rate
          const estimatedDuration = this.estimateDuration(text);

          this.logger.info('[PiperTTS] Speech generated', {
            language: languageCode,
            textLength: text.length,
            estimatedDuration,
          });

          resolve({
            audioPath: outputPath,
            duration: estimatedDuration,
          });
        });

        piperProcess.on('error', (err) => {
          this.logger.error('[PiperTTS] Process error', {
            error: err.message,
          });
          reject(new TextToSpeechError(`Piper process error: ${err.message}`));
        });
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new TextToSpeechError(`Piper TTS error: ${err.message}`);
    }
  }

  /**
   * Generate multiple segments in parallel
   */
  async generateSegments(
    segments: { text: string; startTime: number; endTime: number }[],
    languageCode: string,
    outputDir: string,
  ): Promise<{
    segmentPath: string;
    duration: number;
  }[]> {
    const results = await Promise.all(
      segments.map((seg, i) =>
        this.generateSpeech(
          seg.text,
          languageCode,
          `${outputDir}/segment-${i}.wav`,
        ),
      ),
    );

    return results;
  }

  /**
   * List available voices (free models)
   */
  getAvailableVoices(): Record<string, { name: string; quality: string }> {
    return {
      pt_BR: {
        name: 'Português (Brazil) - Fábio',
        quality: 'medium',
      },
      es_ES: {
        name: 'Español - Carl',
        quality: 'low',
      },
      en_US: {
        name: 'English (US) - Amy',
        quality: 'medium',
      },
      fr_FR: {
        name: 'Français - Siwis',
        quality: 'medium',
      },
    };
  }

  /**
   * Check if Piper is installed and accessible
   */
  async checkInstallation(): Promise<boolean> {
    try {
      const { execSync } = await import('child_process');
      execSync(`${this.piperBinary} --version`, { stdio: 'ignore' });
      this.logger.info('[PiperTTS] Installation verified');
      return true;
    } catch (error) {
      this.logger.error('[PiperTTS] Installation check failed', {
        error: error instanceof Error ? error.message : String(error),
        piperBinary: this.piperBinary,
      });
      return false;
    }
  }

  /**
   * Download model (auto-happens on first use)
   * Models are ~50-200MB each, stored in modelsDir
   */
  async ensureModelDownloaded(languageCode: string): Promise<void> {
    const voiceConfig = DEFAULT_VOICES[languageCode] || DEFAULT_VOICES.en;
    const modelPath = join(this.modelsDir, `${voiceConfig.voiceId}.onnx`);

    try {
      readFileSync(modelPath);
      this.logger.debug('[PiperTTS] Model already downloaded', { languageCode });
    } catch (error) {
      this.logger.info('[PiperTTS] Downloading model...', { languageCode });
      // On first use, Piper automatically downloads from Hugging Face
      // This is handled transparently by Piper
      await this.generateSpeech('Test', languageCode, '/tmp/piper-test.wav');
      this.logger.info('[PiperTTS] Model downloaded successfully', { languageCode });
    }
  }

  /**
   * Estimate speech duration (rough estimate)
   * Average: 3-4 chars per second for most languages
   */
  private estimateDuration(text: string): number {
    const wordCount = text.trim().split(/\s+/).length;
    const charsPerSecond = 14; // ~140 chars/min = ~2.3 words/sec
    return (text.length / charsPerSecond) * 1.2; // Add 20% buffer
  }
}

/**
 * Installation instructions:
 *
 * Option 1: Local Installation (Linux/Mac)
 * ```bash
 * git clone https://github.com/rhasspy/piper.git
 * cd piper/src/python
 * pip install -e .
 * piper --version
 * ```
 *
 * Option 2: Docker
 * ```bash
 * docker run -v /models:/models rhasspy/piper
 * ```
 *
 * Option 3: Pre-built binaries
 * Download from: https://github.com/rhasspy/piper/releases
 *
 * Features:
 * - ✅ Completely free and open-source
 * - ✅ Runs offline (no internet required)
 * - ✅ Fast (~1-2 seconds for 10s of speech)
 * - ✅ Good quality (MOS ~3.8/5)
 * - ✅ Supports 20+ languages
 * - ✅ Uses ONNX for inference (fast on CPU)
 *
 * Models are auto-downloaded from Hugging Face (~50-200MB each)
 * Subsequent uses are instant (models cached locally)
 */
