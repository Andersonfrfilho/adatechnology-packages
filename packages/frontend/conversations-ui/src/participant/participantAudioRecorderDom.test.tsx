import { act } from 'react'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from 'bun:test'

import { setupDom, type DomHarness } from '../domHarness.test-helper'
import type { ParticipantAudioRecordingOptions } from './participantAudio.types'
import { useParticipantAudioRecorder } from './useParticipantAudioRecorder'

type Api = ReturnType<typeof useParticipantAudioRecorder>

class FakeTrack {
  stopCount = 0
  onended: (() => void) | null = null
  onmute: (() => void) | null = null
  onunmute: (() => void) | null = null
  stop(): void {
    this.stopCount += 1
  }
}

class FakeStream {
  readonly track = new FakeTrack()
  getTracks(): FakeTrack[] {
    return [this.track]
  }
}

let supportedTypes: readonly string[] = ['audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm']
let chunkBytes = 4096

class FakeMediaRecorder {
  static isTypeSupported(mimeType: string): boolean {
    return supportedTypes.includes(mimeType)
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
    this.ondataavailable?.({ data: new Blob([new Uint8Array(chunkBytes)]) })
    this.onstop?.()
  }
}

let harness: DomHarness
let api: Api
let stream: FakeStream
let resolveStream: ((value: FakeStream) => void) | undefined
let revoked: string[]
let captureEvents: boolean[]
let getUserMediaImpl: () => Promise<FakeStream>

function Probe({ options, channelMaxBytes }: { options?: ParticipantAudioRecordingOptions; channelMaxBytes?: number }) {
  api = useParticipantAudioRecorder({ options: { ...options, onCaptureChange: (isCapturing) => captureEvents.push(isCapturing) }, channelMaxBytes })
  return null
}

function mountProbe(options?: ParticipantAudioRecordingOptions) {
  return harness.mount(<Probe options={options} />)
}

async function start(): Promise<void> {
  await act(async () => {
    void api.start()
  })
}

async function advance(milliseconds: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(milliseconds)
  })
}

async function recordFor(milliseconds: number): Promise<void> {
  await start()
  await advance(milliseconds)
}

beforeAll(async () => {
  harness = await setupDom()
})

afterAll(() => harness.teardown())

beforeEach(() => {
  jest.useFakeTimers()
  supportedTypes = ['audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm']
  chunkBytes = 4096
  revoked = []
  captureEvents = []
  stream = new FakeStream()
  resolveStream = undefined
  getUserMediaImpl = async () => stream
  const globals = globalThis as Record<string, unknown>
  globals.MediaRecorder = FakeMediaRecorder
  ;(navigator as unknown as Record<string, unknown>).mediaDevices = { getUserMedia: () => getUserMediaImpl() }
  URL.createObjectURL = () => 'blob:fake-recording'
  URL.revokeObjectURL = (url: string) => {
    revoked.push(url)
  }
})

afterEach(() => {
  jest.useRealTimers()
  delete (globalThis as Record<string, unknown>).MediaRecorder
})

function deferStream(): void {
  getUserMediaImpl = () => new Promise<FakeStream>((resolve) => (resolveStream = resolve))
}

describe('the happy path', () => {
  it('goes idle -> requesting -> recording -> review with a coherent File', async () => {
    mountProbe()
    expect(api.status).toBe('idle')
    deferStream()
    await start()
    expect(api.status).toBe('requesting')
    await act(async () => resolveStream?.(stream))
    expect(api.status).toBe('recording')
    await advance(1500)
    act(() => api.stop())
    expect(api.status).toBe('review')
    expect(api.recorded?.file.type).toBe('audio/ogg')
    expect(api.recorded?.file.name).toMatch(/^audio-\d{8}-\d{6}\.ogg$/)
    expect(api.recorded?.file.size).toBe(4096)
    expect(api.recorded?.objectUrl).toBe('blob:fake-recording')
    expect(stream.track.stopCount).toBeGreaterThan(0)
  })

  it('falls back to m4a with the matching mime type', async () => {
    supportedTypes = ['audio/mp4']
    mountProbe()
    await recordFor(1000)
    act(() => api.stop())
    expect(api.recorded?.file.name).toMatch(/\.m4a$/)
    expect(api.recorded?.file.type).toBe('audio/mp4')
  })

  it('reports capture from requesting until it leaves review, and revokes the URL on every exit', async () => {
    mountProbe()
    await recordFor(1000)
    act(() => api.stop())
    expect(captureEvents).toEqual([true])
    let file: File | undefined
    act(() => {
      file = api.confirm()
    })
    expect(file?.size).toBe(4096)
    expect(api.status).toBe('idle')
    expect(revoked).toEqual(['blob:fake-recording'])
    expect(captureEvents).toEqual([true, false])
  })

  it('discard from review revokes the URL and returns to idle', async () => {
    mountProbe()
    await recordFor(1000)
    act(() => api.stop())
    act(() => api.discard())
    expect(api.status).toBe('idle')
    expect(revoked).toEqual(['blob:fake-recording'])
  })

  it('discard while recording stops the track and records nothing', async () => {
    mountProbe()
    await recordFor(1000)
    act(() => api.discard())
    expect(api.status).toBe('idle')
    expect(stream.track.stopCount).toBeGreaterThan(0)
    expect(api.recorded).toBeUndefined()
  })
})

describe('failures', () => {
  it('permission denied -> denied, and the next tap asks again', async () => {
    getUserMediaImpl = () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' }))
    mountProbe()
    await start()
    expect(api.status).toBe('denied')
    getUserMediaImpl = async () => stream
    await start()
    expect(api.status).toBe('recording')
  })

  it('no microphone device -> unsupported', async () => {
    getUserMediaImpl = () => Promise.reject(Object.assign(new Error('x'), { name: 'NotFoundError' }))
    mountProbe()
    await start()
    expect(api.status).toBe('unsupported')
  })

  it('no MediaRecorder at all -> unsupported without asking for the microphone', async () => {
    delete (globalThis as Record<string, unknown>).MediaRecorder
    let asked = false
    getUserMediaImpl = async () => {
      asked = true
      return stream
    }
    mountProbe()
    await start()
    expect(api.status).toBe('unsupported')
    expect(asked).toBe(false)
  })

  it('a recording with no bytes -> empty, tracks released', async () => {
    chunkBytes = 0
    mountProbe()
    await recordFor(1000)
    act(() => api.stop())
    expect(api.status).toBe('empty')
    expect(stream.track.stopCount).toBeGreaterThan(0)
    expect(revoked).toEqual([])
  })

  it('stopping before the minimum duration -> empty', async () => {
    mountProbe()
    await recordFor(100)
    act(() => api.stop())
    expect(api.status).toBe('empty')
  })

  it('above the byte ceiling -> tooLarge, nothing kept', async () => {
    mountProbe({ maxSizeBytes: 1000 })
    await recordFor(1000)
    act(() => api.stop())
    expect(api.status).toBe('tooLarge')
    expect(api.recorded).toBeUndefined()
  })
})

describe('the duration ceiling', () => {
  it('stops by itself at the ceiling and lands in review', async () => {
    mountProbe({ maxDurationMs: 2000 })
    await recordFor(1000)
    expect(api.status).toBe('recording')
    await advance(1100)
    expect(api.status).toBe('review')
  })

  it('shows the elapsed time while recording', async () => {
    mountProbe()
    await recordFor(3000)
    expect(api.elapsedMs).toBeGreaterThanOrEqual(2750)
  })
})

describe('cancellation token of getUserMedia (contract 2.1)', () => {
  it('unmount while requesting: a late stream gets every track stopped at once', async () => {
    deferStream()
    const tree = mountProbe()
    await start()
    tree.unmount()
    await act(async () => resolveStream?.(stream))
    expect(stream.track.stopCount).toBe(1)
  })

  it('page hidden while requesting: back to idle and the late stream is stopped', async () => {
    deferStream()
    mountProbe()
    await start()
    hidePage()
    expect(api.status).toBe('idle')
    await act(async () => resolveStream?.(stream))
    expect(stream.track.stopCount).toBe(1)
    expect(api.status).toBe('idle')
  })

  it('pagehide while requesting also cancels', async () => {
    deferStream()
    mountProbe()
    await start()
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    await act(async () => resolveStream?.(stream))
    expect(stream.track.stopCount).toBe(1)
    expect(api.status).toBe('idle')
  })
})

function hidePage(): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
}

describe('interruptions (contract 2.1)', () => {
  it('track.onended while recording stops and goes to review', async () => {
    mountProbe()
    await recordFor(1000)
    act(() => stream.track.onended?.())
    expect(api.status).toBe('review')
  })

  it('a mute shorter than 3 s does not interrupt', async () => {
    mountProbe()
    await recordFor(1000)
    act(() => stream.track.onmute?.())
    await advance(2900)
    act(() => stream.track.onunmute?.())
    await advance(5000)
    expect(api.status).toBe('recording')
  })

  it('a mute that persists past 3 s interrupts', async () => {
    mountProbe()
    await recordFor(1000)
    act(() => stream.track.onmute?.())
    await advance(2900)
    expect(api.status).toBe('recording')
    await advance(200)
    expect(api.status).toBe('review')
  })

  it('page hidden while recording stops and goes to review', async () => {
    mountProbe()
    await recordFor(1000)
    hidePage()
    expect(api.status).toBe('review')
  })

  it('pagehide while recording stops and goes to review', async () => {
    mountProbe()
    await recordFor(1000)
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(api.status).toBe('review')
  })

  it('page hidden in review pauses the player and KEEPS the recording', async () => {
    mountProbe()
    await recordFor(1000)
    act(() => api.stop())
    let paused = 0
    ;(api.audioRef as { current: unknown }).current = { pause: () => (paused += 1) }
    hidePage()
    expect(paused).toBe(1)
    expect(api.status).toBe('review')
    expect(api.recorded?.file.size).toBe(4096)
    expect(revoked).toEqual([])
  })
})

describe('unmount discards everything', () => {
  it('while recording: tracks stopped, capture reported off', async () => {
    const tree = mountProbe()
    await recordFor(1000)
    tree.unmount()
    expect(stream.track.stopCount).toBeGreaterThan(0)
    expect(captureEvents.at(-1)).toBe(false)
  })

  it('in review: the object URL is revoked', async () => {
    const tree = mountProbe()
    await recordFor(1000)
    act(() => api.stop())
    tree.unmount()
    expect(revoked).toEqual(['blob:fake-recording'])
    expect(captureEvents.at(-1)).toBe(false)
  })
})
