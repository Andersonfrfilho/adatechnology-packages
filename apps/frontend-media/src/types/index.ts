// Frontend Types

export type OutputType = 'transcribe' | 'dub' | 'subtitles';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ProcessingStage = 'extracting' | 'transcribing' | 'translating' | 'generating' | 'aligning' | 'remuxing';

export interface MediaJob {
  id: string;
  status: JobStatus;
  stage: ProcessingStage | null;
  percent: number;
  message: string;
  eta?: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface TranscriptionJob extends MediaJob {
  outputType: 'transcribe';
  transcript?: {
    text: string;
    language: string;
    confidence: number;
    segments: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  };
}

export interface DubbingJob extends MediaJob {
  outputType: 'dub' | 'subtitles';
  detectedLanguage: string;
  targetLanguages: string[];
  results?: {
    videoUrl?: string;
    subtitles?: Array<{
      language: string;
      srtUrl: string;
      format: string;
    }>;
  };
}

export type AnyJob = TranscriptionJob | DubbingJob;

export interface ProgressEvent {
  stage: ProcessingStage;
  percent: number;
  message: string;
  eta?: number;
  details?: Record<string, any>;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}
