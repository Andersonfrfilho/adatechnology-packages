import { describe, expect, it } from 'bun:test'

import { DEFAULT_MAX_RECORDING_MILLISECONDS } from '../audioRecorderFormat'
import {
  canStartRecording,
  classifyCapture,
  classifyMicrophoneError,
  formatRecordingClock,
  MINIMUM_RECORDING_MILLISECONDS,
  reduceRecorderStatus,
  resolveInterruptionAction,
  resolveRecordingLimits,
  type RecorderEvent,
  type RecorderStatus,
} from './participantAudioRecorderState'
import { DEFAULT_MAX_RECORDING_BYTES } from './participantAudio.types'

const SIXTEEN_MIB = 16 * 1024 * 1024

describe('resolveRecordingLimits only lowers the defaults (contract 2)', () => {
  it('uses the defaults when nothing is passed', () => {
    expect(resolveRecordingLimits({})).toEqual({ maxDurationMs: DEFAULT_MAX_RECORDING_MILLISECONDS, maxSizeBytes: SIXTEEN_MIB })
    expect(DEFAULT_MAX_RECORDING_BYTES).toBe(SIXTEEN_MIB)
  })

  it('lowers the duration and the size', () => {
    expect(resolveRecordingLimits({ options: { maxDurationMs: 60_000, maxSizeBytes: 1_000_000 } })).toEqual({
      maxDurationMs: 60_000,
      maxSizeBytes: 1_000_000,
    })
  })

  it('cuts a larger duration or size back to the default', () => {
    const limits = resolveRecordingLimits({ options: { maxDurationMs: 3_600_000, maxSizeBytes: 100 * 1024 * 1024 } })
    expect(limits.maxDurationMs).toBe(DEFAULT_MAX_RECORDING_MILLISECONDS)
    expect(limits.maxSizeBytes).toBe(SIXTEEN_MIB)
  })

  it('takes the smallest of the policy, the channel and the passed value', () => {
    expect(resolveRecordingLimits({ channelMaxBytes: 10 * 1024 * 1024 }).maxSizeBytes).toBe(10 * 1024 * 1024)
    expect(resolveRecordingLimits({ channelMaxBytes: 25 * 1024 * 1024 }).maxSizeBytes).toBe(SIXTEEN_MIB)
    expect(resolveRecordingLimits({ options: { maxSizeBytes: 5_000_000 }, channelMaxBytes: 10_000_000 }).maxSizeBytes).toBe(5_000_000)
  })

  it('ignores values that are not a positive number', () => {
    for (const bad of [0, -5, Number.NaN]) {
      expect(resolveRecordingLimits({ options: { maxDurationMs: bad, maxSizeBytes: bad } })).toEqual({
        maxDurationMs: DEFAULT_MAX_RECORDING_MILLISECONDS,
        maxSizeBytes: SIXTEEN_MIB,
      })
    }
  })
})

describe('reduceRecorderStatus', () => {
  const table: ReadonlyArray<readonly [RecorderStatus, RecorderEvent, RecorderStatus]> = [
    ['idle', 'request', 'requesting'],
    ['denied', 'request', 'requesting'],
    ['unsupported', 'request', 'requesting'],
    ['empty', 'request', 'requesting'],
    ['tooLarge', 'request', 'requesting'],
    ['requesting', 'granted', 'recording'],
    ['requesting', 'microphoneDenied', 'denied'],
    ['requesting', 'microphoneUnavailable', 'unsupported'],
    ['requesting', 'cancel', 'idle'],
    ['recording', 'capturedReview', 'review'],
    ['recording', 'capturedEmpty', 'empty'],
    ['recording', 'capturedTooLarge', 'tooLarge'],
    ['recording', 'cancel', 'idle'],
    ['review', 'cancel', 'idle'],
  ]

  for (const [from, event, to] of table) {
    it(`${from} + ${event} -> ${to}`, () => {
      expect(reduceRecorderStatus(from, event)).toBe(to)
    })
  }

  it('ignores events that do not apply to the current state', () => {
    expect(reduceRecorderStatus('recording', 'request')).toBe('recording')
    expect(reduceRecorderStatus('review', 'request')).toBe('review')
    expect(reduceRecorderStatus('requesting', 'request')).toBe('requesting')
    expect(reduceRecorderStatus('idle', 'granted')).toBe('idle')
    expect(reduceRecorderStatus('review', 'capturedEmpty')).toBe('review')
  })
})

describe('resolveInterruptionAction (contract 2.1)', () => {
  it('stops a recording, pauses a review, cancels a pending request', () => {
    expect(resolveInterruptionAction('recording')).toBe('stop')
    expect(resolveInterruptionAction('review')).toBe('pause')
    expect(resolveInterruptionAction('requesting')).toBe('cancel')
  })

  it('ignores the idle and error states', () => {
    for (const status of ['idle', 'denied', 'unsupported', 'empty', 'tooLarge'] as const) {
      expect(resolveInterruptionAction(status)).toBe('ignore')
    }
  })
})

describe('classifyCapture', () => {
  const limits = { maxDurationMs: 300_000, maxSizeBytes: 1000 }

  it('is empty without bytes or below the minimum duration', () => {
    expect(classifyCapture({ sizeBytes: 0, durationMs: 5000 }, limits)).toBe('capturedEmpty')
    expect(classifyCapture({ sizeBytes: 500, durationMs: 0 }, limits)).toBe('capturedEmpty')
    expect(classifyCapture({ sizeBytes: 500, durationMs: MINIMUM_RECORDING_MILLISECONDS - 1 }, limits)).toBe('capturedEmpty')
  })

  it('is too large above the byte ceiling and fine at it', () => {
    expect(classifyCapture({ sizeBytes: 1001, durationMs: 5000 }, limits)).toBe('capturedTooLarge')
    expect(classifyCapture({ sizeBytes: 1000, durationMs: MINIMUM_RECORDING_MILLISECONDS }, limits)).toBe('capturedReview')
  })
})

describe('classifyMicrophoneError', () => {
  it('maps the permission errors to denied and the rest to unavailable', () => {
    expect(classifyMicrophoneError({ name: 'NotAllowedError' })).toBe('microphoneDenied')
    expect(classifyMicrophoneError({ name: 'SecurityError' })).toBe('microphoneDenied')
    for (const name of ['NotFoundError', 'NotReadableError', 'OverconstrainedError', 'AbortError']) {
      expect(classifyMicrophoneError({ name })).toBe('microphoneUnavailable')
    }
    expect(classifyMicrophoneError('boom')).toBe('microphoneUnavailable')
    expect(classifyMicrophoneError(undefined)).toBe('microphoneUnavailable')
  })
})

describe('formatRecordingClock', () => {
  it('formats m:ss, flooring the seconds', () => {
    expect(formatRecordingClock(0)).toBe('0:00')
    expect(formatRecordingClock(12_999)).toBe('0:12')
    expect(formatRecordingClock(65_000)).toBe('1:05')
    expect(formatRecordingClock(300_000)).toBe('5:00')
    expect(formatRecordingClock(-10)).toBe('0:00')
  })
})

describe('canStartRecording', () => {
  it('lets a tap start only from idle and the failure states', () => {
    for (const status of ['idle', 'denied', 'unsupported', 'empty', 'tooLarge'] as const) expect(canStartRecording(status)).toBe(true)
    for (const status of ['requesting', 'recording', 'review'] as const) expect(canStartRecording(status)).toBe(false)
  })
})
