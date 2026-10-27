import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'

import type { CaptureSession } from './participantAudioCapture'
import type { RecorderStatus } from './participantAudioRecorderState'

const ELAPSED_TICK_MS = 250

export function useRecorderInterruptionListeners(onInterruption: () => void): void {
  useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') onInterruption()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', onInterruption)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', onInterruption)
    }
  }, [onInterruption])
}

type RecordingClockParams = {
  readonly status: RecorderStatus
  readonly maxDurationMs: number
  readonly sessionRef: MutableRefObject<CaptureSession | undefined>
  readonly setElapsedMs: Dispatch<SetStateAction<number>>
  readonly stop: () => void
}

export function useRecordingClock({ status, maxDurationMs, sessionRef, setElapsedMs, stop }: RecordingClockParams): void {
  useEffect(() => {
    if (status !== 'recording') return undefined
    const startedAt = sessionRef.current?.startedAt ?? Date.now()
    const tick = setInterval(() => setElapsedMs(Date.now() - startedAt), ELAPSED_TICK_MS)
    const ceiling = setTimeout(stop, maxDurationMs)
    return () => {
      clearInterval(tick)
      clearTimeout(ceiling)
    }
  }, [status, maxDurationMs, sessionRef, setElapsedMs, stop])
}

type RecorderLifecycleParams = {
  readonly status: RecorderStatus
  readonly onCaptureChange: ((isCapturing: boolean) => void) | undefined
  readonly teardown: () => void
}

export function useRecorderLifecycle({ status, onCaptureChange, teardown }: RecorderLifecycleParams): void {
  const isCapturing = status === 'requesting' || status === 'recording' || status === 'review'
  const reportedRef = useRef(false)
  const onCaptureChangeRef = useRef(onCaptureChange)
  onCaptureChangeRef.current = onCaptureChange

  useEffect(() => {
    if (reportedRef.current === isCapturing) return
    reportedRef.current = isCapturing
    onCaptureChangeRef.current?.(isCapturing)
  }, [isCapturing])

  useEffect(
    () => () => {
      teardown()
      if (!reportedRef.current) return
      reportedRef.current = false
      onCaptureChangeRef.current?.(false)
    },
    [teardown],
  )
}
