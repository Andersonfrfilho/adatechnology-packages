// Media Processor Error Classes

export class MediaProcessorError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, any>,
  ) {
    super(message);
    this.name = 'MediaProcessorError';
  }
}

export class JobNotFoundError extends MediaProcessorError {
  constructor(jobId: string) {
    super('JOB_NOT_FOUND', `Job ${jobId} not found`, { jobId });
  }
}

export class InvalidJobStatusError extends MediaProcessorError {
  constructor(jobId: string, currentStatus: string, expectedStatus: string) {
    super('INVALID_JOB_STATUS',
      `Job ${jobId} status is ${currentStatus}, expected ${expectedStatus}`,
      { jobId, currentStatus, expectedStatus }
    );
  }
}

export class LanguageDetectionError extends MediaProcessorError {
  constructor(message: string, details?: Record<string, any>) {
    super('LANGUAGE_DETECTION_FAILED', message, details);
  }
}

export class TranscriptionError extends MediaProcessorError {
  constructor(message: string, details?: Record<string, any>) {
    super('TRANSCRIPTION_FAILED', message, details);
  }
}

export class TranslationError extends MediaProcessorError {
  constructor(message: string, details?: Record<string, any>) {
    super('TRANSLATION_FAILED', message, details);
  }
}

export class TextToSpeechError extends MediaProcessorError {
  constructor(message: string, details?: Record<string, any>) {
    super('TTS_FAILED', message, details);
  }
}

export class AudioProcessingError extends MediaProcessorError {
  constructor(message: string, details?: Record<string, any>) {
    super('AUDIO_PROCESSING_FAILED', message, details);
  }
}

export class VideoRemuxError extends MediaProcessorError {
  constructor(message: string, details?: Record<string, any>) {
    super('VIDEO_REMUX_FAILED', message, details);
  }
}

export class StorageError extends MediaProcessorError {
  constructor(message: string, details?: Record<string, any>) {
    super('STORAGE_ERROR', message, details);
  }
}

export class CircuitBreakerOpenError extends MediaProcessorError {
  constructor(service: string) {
    super('CIRCUIT_BREAKER_OPEN',
      `Service ${service} is temporarily unavailable`,
      { service }
    );
  }
}

export class RateLimitError extends MediaProcessorError {
  constructor(service: string, retryAfter?: number) {
    super('RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded for ${service}`,
      { service, retryAfter }
    );
  }
}

export class ValidationError extends MediaProcessorError {
  constructor(message: string, details?: Record<string, any>) {
    super('VALIDATION_ERROR', message, details);
  }
}
