import { act } from 'react'

import { afterAll, afterEach, beforeAll, beforeEach, jest } from 'bun:test'

import { setupDom, type DomHarness } from '../domHarness.test-helper'
import type { ParticipantAudioRecordingOptions } from './participantAudio.types'
import { useParticipantAudioRecorder } from './useParticipantAudioRecorder'

export type RecorderApi = ReturnType<typeof useParticipantAudioRecorder>

export class FakeTrack {
  stopCount = 0
  onended: (() => void) | null = null
  onmute: (() => void) | null = null
  onunmute: (() => void) | null = null
  stop(): void {
    this.stopCount += 1
  }
}

export class FakeStream {
  readonly track = new FakeTrack()
  getTracks(): FakeTrack[] {
    return [this.track]
  }
}

/** Mutable state shared by the recorder DOM suites; each suite file builds its own through `setupRecorderDom`. */
export type RecorderDomKit = {
  harness: DomHarness
  api: RecorderApi
  stream: FakeStream
  supportedTypes: readonly string[]
  chunkBytes: number
  revoked: string[]
  captureEvents: boolean[]
  resolveStream: ((value: FakeStream) => void) | undefined
  getUserMediaImpl: () => Promise<FakeStream>
  mountProbe: (options?: ParticipantAudioRecordingOptions) => ReturnType<DomHarness['mount']>
  start: () => Promise<void>
  advance: (milliseconds: number) => Promise<void>
  recordFor: (milliseconds: number) => Promise<void>
  deferStream: () => void
  hidePage: () => void
}

export function setupRecorderDom(): RecorderDomKit {
  class FakeMediaRecorder {
    static isTypeSupported(mimeType: string): boolean {
      return kit.supportedTypes.includes(mimeType)
    }
    state: 'inactive' | 'recording' = 'inactive'
    ondataavailable: ((event: { data: Blob }) => void) | null = null
    onstop: (() => void) | null = null
    onerror: (() => void) | null = null
    constructor(readonly stream: FakeStream, readonly options: { mimeType: string }) {}
    start(): void {
      this.state = 'recording'
    }
    stop(): void {
      this.state = 'inactive'
      this.ondataavailable?.({ data: new Blob([new Uint8Array(kit.chunkBytes)]) })
      this.onstop?.()
    }
  }

  function Probe({ options, channelMaxBytes }: { options?: ParticipantAudioRecordingOptions; channelMaxBytes?: number }) {
    kit.api = useParticipantAudioRecorder({ options: { ...options, onCaptureChange: (isCapturing) => kit.captureEvents.push(isCapturing) }, channelMaxBytes })
    return null
  }

  const kit = {
    mountProbe: (options?: ParticipantAudioRecordingOptions) => kit.harness.mount(<Probe options={options} />),
    start: async () => {
      await act(async () => {
        void kit.api.start()
      })
    },
    advance: async (milliseconds: number) => {
      await act(async () => {
        jest.advanceTimersByTime(milliseconds)
      })
    },
    recordFor: async (milliseconds: number) => {
      await kit.start()
      await kit.advance(milliseconds)
    },
    deferStream: () => {
      kit.getUserMediaImpl = () => new Promise<FakeStream>((resolve) => (kit.resolveStream = resolve))
    },
    hidePage: () => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    },
  } as unknown as RecorderDomKit

  beforeAll(async () => {
    kit.harness = await setupDom()
  })

  afterAll(() => kit.harness.teardown())

  beforeEach(() => {
    jest.useFakeTimers()
    kit.supportedTypes = ['audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm']
    kit.chunkBytes = 4096
    kit.revoked = []
    kit.captureEvents = []
    kit.stream = new FakeStream()
    kit.resolveStream = undefined
    kit.getUserMediaImpl = async () => kit.stream
    ;(globalThis as Record<string, unknown>).MediaRecorder = FakeMediaRecorder
    ;(navigator as unknown as Record<string, unknown>).mediaDevices = { getUserMedia: () => kit.getUserMediaImpl() }
    URL.createObjectURL = () => 'blob:fake-recording'
    URL.revokeObjectURL = (url: string) => {
      kit.revoked.push(url)
    }
  })

  afterEach(() => {
    jest.useRealTimers()
    delete (globalThis as Record<string, unknown>).MediaRecorder
  })

  return kit
}
