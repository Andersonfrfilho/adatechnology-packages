export const PLAYBACK_RATES = [1, 1.5, 2] as const
export const SEEK_STEP_SECONDS = 5

const UNKNOWN_CLOCK = '--:--'

export function formatAudioClock(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return UNKNOWN_CLOCK
  const wholeSeconds = Math.floor(seconds)
  const remainder = String(wholeSeconds % 60).padStart(2, '0')
  return `${Math.floor(wholeSeconds / 60)}:${remainder}`
}

export function nextRateIndex(index: number): number {
  return (index + 1) % PLAYBACK_RATES.length
}

export function formatPlaybackRate(rate: number): string {
  return `${rate}×`
}

export function resolveServerDurationSeconds(durationMs: number | undefined): number | undefined {
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs <= 0) return undefined
  return durationMs / 1000
}

export function resolveMediaDurationSeconds(duration: number): number | undefined {
  return Number.isFinite(duration) && duration > 0 ? duration : undefined
}

export type SeekKeyParams = {
  readonly key: string
  readonly position: number
  readonly duration: number | undefined
}

function clampPosition(position: number, duration: number | undefined): number {
  const floored = Math.max(0, position)
  return duration === undefined ? floored : Math.min(duration, floored)
}

/** The position a key moves the bar to, or undefined when the key is not ours to handle. */
export function resolveSeekKeyTarget({ key, position, duration }: SeekKeyParams): number | undefined {
  if (key === 'ArrowRight' || key === 'ArrowUp') return clampPosition(position + SEEK_STEP_SECONDS, duration)
  if (key === 'ArrowLeft' || key === 'ArrowDown') return clampPosition(position - SEEK_STEP_SECONDS, duration)
  if (key === 'Home') return 0
  if (key === 'End') return duration
  return undefined
}

export type SeekMaxParams = {
  readonly duration: number | undefined
  readonly maxSeen: number
  readonly position: number
}

/** Known duration wins; otherwise the largest position seen so far keeps the bar coherent while it grows. */
export function resolveSeekMax({ duration, maxSeen, position }: SeekMaxParams): number {
  if (duration !== undefined) return Math.ceil(duration)
  return Math.ceil(Math.max(maxSeen, position))
}

export type PositionValueTextParams = {
  readonly template: string
  readonly position: number
  readonly duration: number | undefined
}

export function formatPositionValueText({ template, position, duration }: PositionValueTextParams): string {
  const positionText = formatAudioClock(position)
  if (duration === undefined) return positionText
  return template.replace('{position}', positionText).replace('{duration}', formatAudioClock(duration))
}
