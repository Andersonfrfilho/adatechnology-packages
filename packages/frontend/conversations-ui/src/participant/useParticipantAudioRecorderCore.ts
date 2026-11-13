import { useCallback, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'

import type { CaptureSession } from './participantAudioCapture'
import { reduceRecorderStatus, type RecorderEvent, type RecorderStatus, type RecordingLimits } from './participantAudioRecorderState'

export type RecordedAudio = { readonly file: File; readonly objectUrl: string; readonly durationMs: number }

export type RecorderCore = {
  readonly status: RecorderStatus
  readonly elapsedMs: number
  readonly setElapsedMs: Dispatch<SetStateAction<number>>
  readonly recorded: RecordedAudio | undefined
  readonly setRecorded: (recorded: RecordedAudio | undefined) => void
  readonly limitsRef: RefObject<RecordingLimits>
  readonly statusRef: RefObject<RecorderStatus>
  readonly tokenRef: RefObject<number>
  readonly sessionRef: RefObject<CaptureSession | undefined>
  readonly recordedRef: RefObject<RecordedAudio | undefined>
  readonly audioRef: RefObject<HTMLAudioElement | null>
  readonly moveTo: (event: RecorderEvent) => void
  readonly releaseSession: () => void
  readonly releaseRecorded: () => void
}

export function useRecorderCore(limits: RecordingLimits): RecorderCore {
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

  return {
    status, elapsedMs, setElapsedMs, recorded, setRecorded, limitsRef, statusRef, tokenRef,
    sessionRef, recordedRef, audioRef, moveTo, releaseSession, releaseRecorded,
  }
}
