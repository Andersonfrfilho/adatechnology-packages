import type { RecordingFormat } from '../audioRecorderFormat'
import { MUTE_INTERRUPTION_DELAY_MS } from './participantAudioRecorderState'

export type CaptureSession = {
  readonly format: RecordingFormat
  readonly startedAt: number
  readonly requestStop: () => void
  readonly release: () => void
}

export type OpenCaptureSessionParams = {
  readonly stream: MediaStream
  readonly format: RecordingFormat
  readonly onInterrupt: () => void
  readonly onStopped: (blob: Blob, durationMs: number) => void
}

export function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop()
}

export function formatRecordedFileName(moment: Date, extension: string): string {
  const iso = moment.toISOString()
  const day = iso.slice(0, 10).replace(/-/g, '')
  const time = iso.slice(11, 19).replace(/:/g, '')
  return `audio-${day}-${time}.${extension}`
}

export function buildRecordedFile(blob: Blob, format: RecordingFormat, moment: Date = new Date()): File {
  return new File([blob], formatRecordedFileName(moment, format.extension), { type: format.uploadMimeType })
}

function createMuteWatch(onPersistentMute: () => void): { arm: () => void; clear: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined
  const clear = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  const arm = (): void => {
    clear()
    timer = setTimeout(onPersistentMute, MUTE_INTERRUPTION_DELAY_MS)
  }
  return { arm, clear }
}

export function openCaptureSession({ stream, format, onInterrupt, onStopped }: OpenCaptureSessionParams): CaptureSession {
  const recorder = new MediaRecorder(stream, { mimeType: format.mimeType })
  const chunks: Blob[] = []
  const startedAt = Date.now()
  const muteWatch = createMuteWatch(onInterrupt)
  for (const track of stream.getTracks()) {
    track.onended = onInterrupt
    track.onmute = muteWatch.arm
    track.onunmute = muteWatch.clear
  }
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  recorder.onerror = onInterrupt
  recorder.onstop = () => onStopped(new Blob(chunks, { type: format.uploadMimeType }), Date.now() - startedAt)
  recorder.start()

  function requestStop(): void {
    if (recorder.state === 'inactive') onStopped(new Blob(chunks, { type: format.uploadMimeType }), Date.now() - startedAt)
    else recorder.stop()
  }

  function release(): void {
    muteWatch.clear()
    recorder.ondataavailable = null
    recorder.onerror = null
    recorder.onstop = null
    for (const track of stream.getTracks()) {
      track.onended = null
      track.onmute = null
      track.onunmute = null
    }
    stopStream(stream)
  }

  return { format, startedAt, requestStop, release }
}
