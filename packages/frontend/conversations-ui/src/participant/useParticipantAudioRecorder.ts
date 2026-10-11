import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'

import { resolveRecordingFormat, type RecordingFormat } from '../audioRecorderFormat'
import type { ParticipantAudioRecordingOptions } from './participantAudio.types'
import { buildRecordedFile, openCaptureSession, stopStream, type CaptureSession } from './participantAudioCapture'
import {
  canStartRecording,
  classifyCapture,
  classifyMicrophoneError,
  reduceRecorderStatus,
  resolveInterruptionAction,
  resolveRecordingLimits,
  type RecorderEvent,
  type RecorderStatus,
  type RecordingLimits,
} from './participantAudioRecorderState'
import { useRecorderInterruptionListeners, useRecorderLifecycle, useRecordingClock } from './useParticipantAudioRecorderEffects'

export type RecordedAudio = { readonly file: File; readonly objectUrl: string; readonly durationMs: number }

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

export function useParticipantAudioRecorder({ options, channelMaxBytes }: UseParticipantAudioRecorderParams = {}): ParticipantAudioRecorder {
  const limits = useMemo(
    () => resolveRecordingLimits({ options, channelMaxBytes }),
    [options?.maxDurationMs, options?.maxSizeBytes, channelMaxBytes],
  )
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [recorded, setRecorded] = useState<RecordedAudio | undefined>()
  const statusRef = useRef<RecorderStatus>('idle')
  const limitsRef = useRef(limits)
  const tokenRef = useRef(0)
  const sessionRef = useRef<CaptureSession | undefined>(undefined)
  const recordedRef = useRef<RecordedAudio | undefined>(undefined)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  limitsRef.current = limits

  const moveTo = useCallback((event: RecorderEvent): void => {
    statusRef.current = reduceRecorderStatus(statusRef.current, event)
    setStatus(statusRef.current)
  }, [])

  const releaseSession = useCallback((): void => {
    sessionRef.current?.release()
    sessionRef.current = undefined
  }, [])

  const releaseRecorded = useCallback((): void => {
    if (recordedRef.current) URL.revokeObjectURL(recordedRef.current.objectUrl)
    recordedRef.current = undefined
    setRecorded(undefined)
  }, [])

  const finalize = useCallback(
    (blob: Blob, durationMs: number): void => {
      const format = sessionRef.current?.format
      if (statusRef.current !== 'recording' || !format) return
      releaseSession()
      const event = classifyCapture({ sizeBytes: blob.size, durationMs }, limitsRef.current)
      if (event === 'capturedReview') keepRecording(blob, format, durationMs)
      moveTo(event)
    },
    [moveTo, releaseSession],
  )

  function keepRecording(blob: Blob, format: RecordingFormat, durationMs: number): void {
    const file = buildRecordedFile(blob, format)
    recordedRef.current = { file, objectUrl: URL.createObjectURL(file), durationMs }
    setRecorded(recordedRef.current)
  }

  const handleInterruption = useCallback((): void => {
    const action = resolveInterruptionAction(statusRef.current)
    if (action === 'stop') sessionRef.current?.requestStop()
    if (action === 'pause') audioRef.current?.pause()
    if (action === 'cancel') {
      tokenRef.current += 1
      moveTo('cancel')
    }
  }, [moveTo])

  const beginRecording = useCallback(
    (stream: MediaStream, format: RecordingFormat): void => {
      try {
        sessionRef.current = openCaptureSession({ stream, format, onInterrupt: handleInterruption, onStopped: finalize })
      } catch {
        stopStream(stream)
        moveTo('microphoneUnavailable')
        return
      }
      setElapsedMs(0)
      moveTo('granted')
    },
    [finalize, handleInterruption, moveTo],
  )

  const start = useCallback(async (): Promise<void> => {
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
  }, [beginRecording, moveTo])

  const stop = useCallback((): void => sessionRef.current?.requestStop(), [])

  const discard = useCallback((): void => {
    tokenRef.current += 1
    releaseSession()
    releaseRecorded()
    moveTo('cancel')
  }, [moveTo, releaseRecorded, releaseSession])

  const confirm = useCallback((): File | undefined => {
    if (statusRef.current !== 'review') return undefined
    const file = recordedRef.current?.file
    releaseRecorded()
    moveTo('cancel')
    return file
  }, [moveTo, releaseRecorded])

  const teardown = useCallback((): void => {
    tokenRef.current += 1
    releaseSession()
    if (recordedRef.current) URL.revokeObjectURL(recordedRef.current.objectUrl)
    recordedRef.current = undefined
  }, [releaseSession])

  useRecorderInterruptionListeners(handleInterruption)
  useRecordingClock({ status, maxDurationMs: limits.maxDurationMs, sessionRef, setElapsedMs, stop })
  useRecorderLifecycle({ status, onCaptureChange: options?.onCaptureChange, teardown })

  return { status, elapsedMs, limits, recorded, audioRef, start, stop, discard, confirm }
}
