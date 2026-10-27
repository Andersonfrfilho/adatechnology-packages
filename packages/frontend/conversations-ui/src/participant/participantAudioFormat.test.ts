import { describe, expect, it } from 'bun:test'

import {
  PLAYBACK_RATES,
  formatAudioClock,
  formatPlaybackRate,
  formatPositionValueText,
  nextRateIndex,
  resolveMediaDurationSeconds,
  resolveSeekKeyTarget,
  resolveSeekMax,
  resolveServerDurationSeconds,
} from './participantAudioFormat'

describe('formatAudioClock', () => {
  it('formats m:ss and pads the seconds', () => {
    expect(formatAudioClock(0)).toBe('0:00')
    expect(formatAudioClock(12.9)).toBe('0:12')
    expect(formatAudioClock(65)).toBe('1:05')
    expect(formatAudioClock(300)).toBe('5:00')
  })

  it('shows a placeholder when the duration is unknown or infinite', () => {
    expect(formatAudioClock(undefined)).toBe('--:--')
    expect(formatAudioClock(Number.POSITIVE_INFINITY)).toBe('--:--')
    expect(formatAudioClock(Number.NaN)).toBe('--:--')
  })
})

describe('playback rate', () => {
  it('cycles 1x, 1.5x, 2x and back', () => {
    expect(PLAYBACK_RATES).toEqual([1, 1.5, 2])
    expect(nextRateIndex(0)).toBe(1)
    expect(nextRateIndex(1)).toBe(2)
    expect(nextRateIndex(2)).toBe(0)
  })

  it('names the rate with the multiplication sign', () => {
    expect(formatPlaybackRate(1.5)).toBe('1.5×')
    expect(formatPlaybackRate(2)).toBe('2×')
  })
})

describe('durations', () => {
  it('takes the server duration in seconds only when positive and finite', () => {
    expect(resolveServerDurationSeconds(65_000)).toBe(65)
    expect(resolveServerDurationSeconds(undefined)).toBeUndefined()
    expect(resolveServerDurationSeconds(0)).toBeUndefined()
  })

  it('ignores an infinite or NaN media duration (Chromium WebM without a header)', () => {
    expect(resolveMediaDurationSeconds(42)).toBe(42)
    expect(resolveMediaDurationSeconds(Number.POSITIVE_INFINITY)).toBeUndefined()
    expect(resolveMediaDurationSeconds(Number.NaN)).toBeUndefined()
  })
})

describe('keyboard step', () => {
  it('moves 5 seconds with the arrows and clamps at the start and the end', () => {
    expect(resolveSeekKeyTarget({ key: 'ArrowRight', position: 10, duration: 65 })).toBe(15)
    expect(resolveSeekKeyTarget({ key: 'ArrowUp', position: 10, duration: 65 })).toBe(15)
    expect(resolveSeekKeyTarget({ key: 'ArrowLeft', position: 10, duration: 65 })).toBe(5)
    expect(resolveSeekKeyTarget({ key: 'ArrowDown', position: 2, duration: 65 })).toBe(0)
    expect(resolveSeekKeyTarget({ key: 'ArrowRight', position: 63, duration: 65 })).toBe(65)
  })

  it('jumps to the start with Home and to the end with End', () => {
    expect(resolveSeekKeyTarget({ key: 'Home', position: 30, duration: 65 })).toBe(0)
    expect(resolveSeekKeyTarget({ key: 'End', position: 30, duration: 65 })).toBe(65)
  })

  it('does not know the end without a finite duration and leaves other keys alone', () => {
    expect(resolveSeekKeyTarget({ key: 'End', position: 30, duration: undefined })).toBeUndefined()
    expect(resolveSeekKeyTarget({ key: 'ArrowRight', position: 30, duration: undefined })).toBe(35)
    expect(resolveSeekKeyTarget({ key: 'a', position: 30, duration: 65 })).toBeUndefined()
  })
})

describe('range bounds and value text', () => {
  it('uses the rounded-up duration as max when known', () => {
    expect(resolveSeekMax({ duration: 64.2, maxSeen: 3, position: 3 })).toBe(65)
  })

  it('uses the largest position seen as a provisional max when the duration is unknown', () => {
    expect(resolveSeekMax({ duration: undefined, maxSeen: 12, position: 12 })).toBe(12)
    expect(resolveSeekMax({ duration: undefined, maxSeen: 0, position: 0 })).toBe(0)
  })

  it('writes position and duration, or only the position without a duration', () => {
    expect(formatPositionValueText({ template: '{position} of {duration}', position: 12, duration: 65 })).toBe('0:12 of 1:05')
    expect(formatPositionValueText({ template: '{position} of {duration}', position: 12, duration: undefined })).toBe('0:12')
  })
})
