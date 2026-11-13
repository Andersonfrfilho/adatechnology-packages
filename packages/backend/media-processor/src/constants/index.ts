// Media Processor Constants

export const PROCESSING_STAGES = {
  EXTRACTING: 'extracting',
  TRANSCRIBING: 'transcribing',
  TRANSLATING: 'translating',
  GENERATING: 'generating',
  ALIGNING: 'aligning',
  REMUXING: 'remuxing',
} as const;

export const STAGE_LABELS = {
  [PROCESSING_STAGES.EXTRACTING]: '🎬 Extraindo áudio...',
  [PROCESSING_STAGES.TRANSCRIBING]: '🗣️ Transcrevendo...',
  [PROCESSING_STAGES.TRANSLATING]: '🌍 Traduzindo...',
  [PROCESSING_STAGES.GENERATING]: '🎤 Gerando áudio...',
  [PROCESSING_STAGES.ALIGNING]: '⏱️ Alinhando timing...',
  [PROCESSING_STAGES.REMUXING]: '🎬 Finalizando vídeo...',
} as const;

export const STAGE_PROGRESS = {
  [PROCESSING_STAGES.EXTRACTING]: 5,
  [PROCESSING_STAGES.TRANSCRIBING]: 30,
  [PROCESSING_STAGES.TRANSLATING]: 50,
  [PROCESSING_STAGES.GENERATING]: 70,
  [PROCESSING_STAGES.ALIGNING]: 85,
  [PROCESSING_STAGES.REMUXING]: 95,
} as const;

export const STAGE_DURATION_SECONDS = {
  [PROCESSING_STAGES.EXTRACTING]: 10,
  [PROCESSING_STAGES.TRANSCRIBING]: 120,
  [PROCESSING_STAGES.TRANSLATING]: 30,
  [PROCESSING_STAGES.GENERATING]: 180,
  [PROCESSING_STAGES.ALIGNING]: 30,
  [PROCESSING_STAGES.REMUXING]: 60,
} as const;

// Queue configuration
export const QUEUE_CONFIG = {
  QUEUE_NAME: 'media-processing',
  DELAY_QUEUE_NAME: 'media-processing-delay',
  CONCURRENCY: 1,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_BACKOFF_MULTIPLIER: 2, // exponential: 1min, 2min, 4min
  STALLED_INTERVAL: 5000,
  STALLED_COUNT: 2,
  JOB_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
  REMOVE_ON_COMPLETE_AFTER: 48 * 60 * 60, // 48 hours
} as const;

// WebSocket configuration
export const WEBSOCKET_CONFIG = {
  PING_INTERVAL: 25000,
  PING_TIMEOUT: 60000,
  TRANSPORTS: ['websocket'],
  HEARTBEAT_INTERVAL: 5000,
  HEARTBEAT_TIMEOUT: 30000,
} as const;

// API rate limits (requests per minute)
export const RATE_LIMITS = {
  WHISPER: 3,
  ELEVENLABS: 3,
  OPENAI_TRANSLATE: 5,
} as const;

// Supported languages
export const SUPPORTED_LANGUAGES = {
  PT: { code: 'pt', label: 'Português (Brasil)', ttsVoice: 'pt-BR' },
  ES: { code: 'es', label: 'Español', ttsVoice: 'es-ES' },
  EN: { code: 'en', label: 'English', ttsVoice: 'en-US' },
  FR: { code: 'fr', label: 'Français', ttsVoice: 'fr-FR' },
  IT: { code: 'it', label: 'Italiano', ttsVoice: 'it-IT' },
} as const;

// FFmpeg configuration
export const FFMPEG_CONFIG = {
  AUDIO_SAMPLE_RATE: 16000,
  AUDIO_FORMAT: 'pcm_s16le',
  VIDEO_CODEC: 'libx264',
  AUDIO_CODEC: 'aac',
  VIDEO_BITRATE: '5000k',
  AUDIO_BITRATE: '128k',
} as const;

// Error codes
export const ERROR_CODES = {
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  INVALID_JOB_STATUS: 'INVALID_JOB_STATUS',
  LANGUAGE_DETECTION_FAILED: 'LANGUAGE_DETECTION_FAILED',
  TRANSCRIPTION_FAILED: 'TRANSCRIPTION_FAILED',
  TRANSLATION_FAILED: 'TRANSLATION_FAILED',
  TTS_FAILED: 'TTS_FAILED',
  AUDIO_PROCESSING_FAILED: 'AUDIO_PROCESSING_FAILED',
  VIDEO_REMUX_FAILED: 'VIDEO_REMUX_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',
  CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

// Temp file paths
export const TEMP_PATHS = {
  BASE: '/tmp',
  AUDIO: 'audio.wav',
  TRANSCRIPT: 'transcript.json',
  DUBBED_SEGMENTS: 'dubbed_segments',
  FINAL_AUDIO: 'final_audio.wav',
  SUBTITLES: 'subtitles',
} as const;

// Limits
export const LIMITS = {
  MAX_VIDEO_SIZE_MB: 5000,
  MAX_VIDEO_DURATION_MINUTES: 480, // 8 hours
  MAX_JOB_QUEUE_DEPTH: 10000,
  ALERT_QUEUE_DEPTH: 100,
  MAX_MEMORY_MB: 2048,
  MAX_TEMP_FILES_GB: 100,
} as const;
