import { DEFAULT_MAX_RECORDING_MILLISECONDS } from '../audioRecorderFormat'
import { DEFAULT_MAX_RECORDING_BYTES, type ParticipantAudioRecordingOptions } from './participantAudio.types'

export type RecorderStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'review'
  | 'denied'
  | 'unsupported'
  | 'empty'
  | 'tooLarge'

export type RecorderEvent =
  | 'request'
  | 'granted'
  | 'microphoneDenied'
  | 'microphoneUnavailable'
  | 'capturedReview'
  | 'capturedEmpty'
  | 'capturedTooLarge'
  | 'cancel'

export type InterruptionAction = 'stop' | 'pause' | 'cancel' | 'ignore'
export type RecordingLimits = { readonly maxDurationMs: number; readonly maxSizeBytes: number }
export type CaptureMeasure = { readonly sizeBytes: number; readonly durationMs: number }

export const MINIMUM_RECORDING_MILLISECONDS = 500
export const MUTE_INTERRUPTION_DELAY_MS = 3000

const RETRYABLE: readonly RecorderStatus[] = ['idle', 'denied', 'unsupported', 'empty', 'tooLarge']

const TRANSITIONS: Readonly<Record<RecorderEvent, ReadonlyArray<readonly [readonly RecorderStatus[], RecorderStatus]>>> = {
  request: [[RETRYABLE, 'requesting']],
  granted: [[['requesting'], 'recording']],
  microphoneDenied: [[['requesting'], 'denied']],
  microphoneUnavailable: [[['requesting'], 'unsupported']],
  capturedReview: [[['recording'], 'review']],
  capturedEmpty: [[['recording'], 'empty']],
  capturedTooLarge: [[['recording'], 'tooLarge']],
  cancel: [[['requesting', 'recording', 'review'], 'idle']],
}

export function canStartRecording(status: RecorderStatus): boolean {
  return RETRYABLE.includes(status)
}

export function reduceRecorderStatus(status: RecorderStatus, event: RecorderEvent): RecorderStatus {
  const match = TRANSITIONS[event].find(([from]) => from.includes(status))
  return match ? match[1] : status
}

export function resolveInterruptionAction(status: RecorderStatus): InterruptionAction {
  if (status === 'recording') return 'stop'
  if (status === 'review') return 'pause'
  if (status === 'requesting') return 'cancel'
  return 'ignore'
}

function lowerOnly(requested: number | undefined, ceiling: number): number {
  if (requested === undefined || !Number.isFinite(requested) || requested <= 0) return ceiling
  return Math.min(requested, ceiling)
}

export type ResolveRecordingLimitsParams = {
  readonly options?: ParticipantAudioRecordingOptions
  readonly channelMaxBytes?: number
}

export function resolveRecordingLimits({ options, channelMaxBytes }: ResolveRecordingLimitsParams): RecordingLimits {
  const sizeCeiling = lowerOnly(channelMaxBytes, DEFAULT_MAX_RECORDING_BYTES)
  return {
    maxDurationMs: lowerOnly(options?.maxDurationMs, DEFAULT_MAX_RECORDING_MILLISECONDS),
    maxSizeBytes: lowerOnly(options?.maxSizeBytes, sizeCeiling),
  }
}

export function classifyCapture({ sizeBytes, durationMs }: CaptureMeasure, limits: RecordingLimits): RecorderEvent {
  if (sizeBytes === 0 || durationMs < MINIMUM_RECORDING_MILLISECONDS) return 'capturedEmpty'
  if (sizeBytes > limits.maxSizeBytes) return 'capturedTooLarge'
  return 'capturedReview'
}

export function classifyMicrophoneError(error: unknown): 'microphoneDenied' | 'microphoneUnavailable' {
  const name = typeof error === 'object' && error !== null && 'name' in error ? (error as { name: unknown }).name : undefined
  return name === 'NotAllowedError' || name === 'SecurityError' ? 'microphoneDenied' : 'microphoneUnavailable'
}

export function formatRecordingClock(milliseconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${Math.floor(totalSeconds / 60)}:${seconds}`
}
