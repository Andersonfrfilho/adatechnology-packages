// Subtitle Service - Generate SRT/VTT files

import { TranscriptSegment, Subtitle } from '../types/index.js';
import { Logger } from '@adatechnology/logger';

export class SubtitleService {
  constructor(private logger: Logger) {}

  /**
   * Generate SRT format subtitle file
   * Format:
   * 1
   * 00:00:00,500 --> 00:00:02,100
   * Subtitle text
   */
  generateSRT(segments: TranscriptSegment[]): string {
    const lines: string[] = [];

    segments.forEach((segment, index) => {
      lines.push(String(index + 1)); // Sequence number
      lines.push(`${this.formatTimestamp(segment.startTime)} --> ${this.formatTimestamp(segment.endTime)}`);
      lines.push(segment.originalText);
      lines.push(''); // Empty line between subtitles
    });

    return lines.join('\n');
  }

  /**
   * Generate VTT format subtitle file
   * Format:
   * WEBVTT
   *
   * 00:00:00.500 --> 00:00:02.100
   * Subtitle text
   */
  generateVTT(segments: TranscriptSegment[]): string {
    const lines: string[] = ['WEBVTT', ''];

    segments.forEach((segment) => {
      lines.push(`${this.formatTimestampVTT(segment.startTime)} --> ${this.formatTimestampVTT(segment.endTime)}`);
      lines.push(segment.originalText);
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Generate translated subtitles for multiple languages
   */
  async generateMultiLanguageSubtitles(
    segments: TranscriptSegment[],
    languages: string[],
    format: 'srt' | 'vtt' = 'srt',
  ): Promise<Record<string, string>> {
    const results: Record<string, string> = {};

    for (const lang of languages) {
      // In production, this would translate segments here
      // For now, just generate with original text
      const generator = format === 'srt' ? this.generateSRT : this.generateVTT;
      results[lang] = generator.call(this, segments);
    }

    return results;
  }

  /**
   * Format timestamp for SRT (HH:MM:SS,mmm)
   */
  private formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  }

  /**
   * Format timestamp for VTT (HH:MM:SS.mmm)
   */
  private formatTimestampVTT(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  /**
   * Merge subtitle segments into larger blocks (useful for readability)
   * e.g., combine multiple short segments into one bigger subtitle
   */
  mergeSegments(
    segments: TranscriptSegment[],
    maxDurationSeconds = 5,
    maxChars = 100,
  ): TranscriptSegment[] {
    if (segments.length === 0) return [];

    const merged: TranscriptSegment[] = [];
    let currentMerged = { ...segments[0] };
    let currentChars = segments[0].originalText.length;

    for (let i = 1; i < segments.length; i++) {
      const segment = segments[i];
      const duration = segment.endTime - currentMerged.startTime;
      const newChars = currentChars + 1 + segment.originalText.length; // +1 for space

      if (duration <= maxDurationSeconds && newChars <= maxChars) {
        // Merge
        currentMerged.originalText += ' ' + segment.originalText;
        currentMerged.endTime = segment.endTime;
        currentChars = newChars;
      } else {
        // Start new segment
        merged.push(currentMerged);
        currentMerged = { ...segment };
        currentChars = segment.originalText.length;
      }
    }

    merged.push(currentMerged);
    return merged;
  }

  /**
   * Extract timing and text from SRT string (for validation/import)
   */
  parseSRT(srtContent: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];
    const blocks = srtContent.split('\n\n').filter(block => block.trim());

    blocks.forEach((block, index) => {
      const lines = block.trim().split('\n');
      if (lines.length < 3) return;

      // Skip sequence number (lines[0])
      const timingLine = lines[1];
      const [startStr, endStr] = timingLine.split(' --> ');

      const startTime = this.parseTimestamp(startStr.trim());
      const endTime = this.parseTimestamp(endStr.trim());
      const text = lines.slice(2).join('\n');

      segments.push({
        id: crypto.randomUUID(),
        jobId: '',
        sequenceNumber: index,
        startTime,
        endTime,
        originalText: text,
      });
    });

    return segments;
  }

  /**
   * Parse timestamp from SRT format (HH:MM:SS,mmm)
   */
  private parseTimestamp(timeStr: string): number {
    const parts = timeStr.replace(',', '.').split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2]);

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Validate subtitle content (check for empty, very long, etc.)
   */
  validateSubtitles(segments: TranscriptSegment[]): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (segments.length === 0) {
      errors.push('No subtitle segments');
    }

    segments.forEach((seg, i) => {
      if (!seg.originalText || seg.originalText.trim().length === 0) {
        errors.push(`Segment ${i}: Empty text`);
      }

      if (seg.originalText.length > 200) {
        errors.push(`Segment ${i}: Text too long (${seg.originalText.length} chars)`);
      }

      if (seg.startTime >= seg.endTime) {
        errors.push(`Segment ${i}: Invalid timing (start >= end)`);
      }

      if (seg.endTime - seg.startTime > 10) {
        errors.push(`Segment ${i}: Duration too long (${seg.endTime - seg.startTime}s)`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
