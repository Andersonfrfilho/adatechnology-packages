export type ParticipantAudioRecordingOptions = {
  /** Only lowers the default: a larger value is cut to DEFAULT_MAX_RECORDING_MILLISECONDS (5 min). */
  readonly maxDurationMs?: number
  /** Only lowers the default: a larger value is cut to DEFAULT_MAX_RECORDING_BYTES (16 MiB, the app audio policy). */
  readonly maxSizeBytes?: number
  /** True from `requesting` until it leaves `review`; the host feeds its capture registry. Never receives the audio. */
  readonly onCaptureChange?: (isCapturing: boolean) => void
}

export const DEFAULT_MAX_RECORDING_BYTES = 16 * 1024 * 1024
