import { useCallback, useMemo, type RefObject } from 'react'

import { resolveRecordingFormat, type RecordingFormat } from '../audioRecorderFormat'
import type { ParticipantAudioRecordingOptions } from './participantAudio.types'
import { buildRecordedFile, openCaptureSession, stopStream } from './participantAudioCapture'
import {
  canStartRecording,
  classifyCapture,
  classifyMicrophoneError,
  resolveInterruptionAction,
  resolveRecordingLimits,
  type RecorderStatus,
  type RecordingLimits,
} from './participantAudioRecorderState'
import { useRecorderCore, type RecorderCore, type RecordedAudio } from './useParticipantAudioRecorderCore'
import { useRecorderInterruptionListeners, useRecorderLifecycle, useRecordingClock } from './useParticipantAudioRecorderEffects'

export type { RecordedAudio }

export type UseParticipantAudioRecorderParams = {
  readonly options?: ParticipantAudioRecordingOptions
  readonly channelMaxBytes?: number
}

export type ParticipantAudioRecorder = {
  readonly status: RecorderStatus
  readonly elapsedMs: number
  readonly limits: RecordingLimits
  readonly recorded: RecordedAudio | undefined
  readonly audioRef: RefObject<HTMLAudioElement | null>
  readonly start: () => Promise<void>
  readonly stop: () => void
  readonly discard: () => void
  readonly confirm: () => File | undefined
}

function useRecorderFinalize(core: RecorderCore): (blob: Blob, durationMs: number) => void {
  const { statusRef, sessionRef, recordedRef, limitsRef, setRecorded, moveTo, releaseSession } = core
  return useCallback(
    (blob: Blob, durationMs: number): void => {
      const format = sessionRef.current?.format
      if (statusRef.current !== 'recording' || !format) return
      releaseSession()
      const event = classifyCapture({ sizeBytes: blob.size, durationMs }, limitsRef.current)
      if (event === 'capturedReview') {
        const file = buildRecordedFile(blob, format)
        recordedRef.current = { file, objectUrl: URL.createObjectURL(file), durationMs }
        setRecorded(recordedRef.current)
      }
      moveTo(event)
    },
    [statusRef, sessionRef, recordedRef, limitsRef, setRecorded, moveTo, releaseSession],
  )
}

function useRecorderInterruption(core: RecorderCore): () => void {
  const { statusRef, sessionRef, tokenRef, audioRef, moveTo } = core
  return useCallback((): void => {
    const action = resolveInterruptionAction(statusRef.current)
    if (action === 'stop') sessionRef.current?.requestStop()
    if (action === 'pause') audioRef.current?.pause()
    if (action === 'cancel') {
      tokenRef.current += 1
      moveTo('cancel')
    }
  }, [statusRef, sessionRef, tokenRef, audioRef, moveTo])
}

type RecorderStartParams = {
  readonly onInterrupt: () => void
  readonly onStopped: (blob: Blob, durationMs: number) => void
}

function useRecorderStart(core: RecorderCore, { onInterrupt, onStopped }: RecorderStartParams): () => Promise<void> {
  const { statusRef, tokenRef, sessionRef, setElapsedMs, moveTo } = core
  const beginRecording = useCallback(
    (stream: MediaStream, format: RecordingFormat): void => {
      try {
        sessionRef.current = openCaptureSession({ stream, format, onInterrupt, onStopped })
      } catch {
        stopStream(stream)
        moveTo('microphoneUnavailable')
        return
      }
      setElapsedMs(0)
      moveTo('granted')
    },
    [sessionRef, setElapsedMs, onInterrupt, onStopped, moveTo],
  )

  return useCallback(async (): Promise<void> => {
    if (!canStartRecording(statusRef.current)) return
    const token = (tokenRef.current += 1)
    moveTo('request')
    const format = resolveRecordingFormat()
    if (!format || !navigator.mediaDevices?.getUserMedia) return moveTo('microphoneUnavailable')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (error) {
      if (token === tokenRef.current) moveTo(classifyMicrophoneError(error))
      return
    }
    if (token !== tokenRef.current) return stopStream(stream)
    beginRecording(stream, format)
  }, [statusRef, tokenRef, moveTo, beginRecording])
}

type RecorderActions = Pick<ParticipantAudioRecorder, 'stop' | 'discard' | 'confirm'> & { readonly teardown: () => void }

function useRecorderActions(core: RecorderCore): RecorderActions {
  const { statusRef, tokenRef, sessionRef, recordedRef, moveTo, releaseSession, releaseRecorded } = core
  const stop = useCallback((): void => sessionRef.current?.requestStop(), [sessionRef])
  const discard = useCallback((): void => {
    tokenRef.current += 1
    releaseSession()
    releaseRecorded()
    moveTo('cancel')
  }, [tokenRef, moveTo, releaseRecorded, releaseSession])
  const confirm = useCallback((): File | undefined => {
    if (statusRef.current !== 'review') return undefined
    const file = recordedRef.current?.file
    releaseRecorded()
    moveTo('cancel')
    return file
  }, [statusRef, recordedRef, moveTo, releaseRecorded])
  const teardown = useCallback((): void => {
    tokenRef.current += 1
    releaseSession()
    if (recordedRef.current) URL.revokeObjectURL(recordedRef.current.objectUrl)
    recordedRef.current = undefined
  }, [tokenRef, recordedRef, releaseSession])
  return { stop, discard, confirm, teardown }
}

export function useParticipantAudioRecorder({ options, channelMaxBytes }: UseParticipantAudioRecorderParams = {}): ParticipantAudioRecorder {
  const limits = useMemo(
    () => resolveRecordingLimits({ options, channelMaxBytes }),
    [options?.maxDurationMs, options?.maxSizeBytes, channelMaxBytes],
  )
  const core = useRecorderCore(limits)
  const onInterrupt = useRecorderInterruption(core)
  const onStopped = useRecorderFinalize(core)
  const start = useRecorderStart(core, { onInterrupt, onStopped })
  const { stop, discard, confirm, teardown } = useRecorderActions(core)

  useRecorderInterruptionListeners(onInterrupt)
  useRecordingClock({ status: core.status, maxDurationMs: limits.maxDurationMs, sessionRef: core.sessionRef, setElapsedMs: core.setElapsedMs, stop })
  useRecorderLifecycle({ status: core.status, onCaptureChange: options?.onCaptureChange, teardown })

  const { status, elapsedMs, recorded, audioRef } = core
  return { status, elapsedMs, limits, recorded, audioRef, start, stop, discard, confirm }
}
