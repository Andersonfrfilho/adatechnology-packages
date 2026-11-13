// Media Processor Types & Interfaces

export type OutputType = 'dub' | 'subtitles';
export type MediaJobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ProcessingStage = 'extracting' | 'transcribing' | 'translating' | 'generating' | 'aligning' | 'remuxing';

export interface MediaJobInput {
  videoUrl: string;
  outputType: OutputType;
  targetLanguages: string[]; // ['pt-BR', 'es', 'en']
  subtitleFormat?: 'srt' | 'vtt'; // For subtitles
  subtitleBurned?: boolean; // For subtitles: burn or attach
  dubbingVoiceId?: string; // For dubbing: ElevenLabs voice ID
}

export interface MediaJob {
  id: string;
  videoUrl: string;
  outputType: OutputType;
  status: MediaJobStatus;

  // Language detection
  detectedLanguage: string; // 'pt'
  detectedLanguageConfidence: number; // 0-1
  isLanguageConfirmed: boolean;

  // Subtitles specific
  targetLanguages: string[];
  subtitleFormat?: string;
  subtitleBurned?: boolean;

  // Dubbing specific
  dubbingVoiceId?: string;

  // Progress tracking
  currentStage: ProcessingStage | null;
  progressPercent: number; // 0-100
  progressMessage: string;
  progressEtaSeconds: number | null;

  // Timestamps
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;

  // Error handling
  errorMessage: string | null;
  retryCount: number;
  lastRetryAt: Date | null;

  // Meta
  estimatedDurationSeconds: number | null;
  actualDurationSeconds: number | null;
}

export interface TranscriptSegment {
  id: string;
  jobId: string;
  sequenceNumber: number;
  startTime: number; // seconds
  endTime: number;
  originalText: string;
  speaker?: string;
  confidence?: number;
  isQuestion?: boolean;
  isSilence?: boolean;
}

export interface Subtitle {
  id: string;
  jobId: string;
  language: string; // 'pt-BR', 'es', 'en'
  format: 'srt' | 'vtt';
  srtUrl: string; // S3 presigned URL
  translatedSegments: {
    startTime: string; // "00:00:05,500"
    endTime: string;
    text: string;
  }[];
  createdAt: Date;
}

export interface ProgressEvent {
  stage: ProcessingStage;
  percent: number;
  message: string;
  eta?: number;
  details?: Record<string, any>;
}

export interface DubbingResult {
  videoUrl: string;
  language: string;
  duration: number;
}

export interface SubtitlesResult {
  subtitles: {
    language: string;
    srtUrl: string;
    format: string;
  }[];
  videoUrl?: string; // If burned
}

export interface LanguageDetectionResult {
  detected: string;
  confidence: number;
  name: string;
  alternatives?: string[];
}
