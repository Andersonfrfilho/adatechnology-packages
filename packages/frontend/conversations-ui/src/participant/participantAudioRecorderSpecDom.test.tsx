import { act } from 'react'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from 'bun:test'

import { setupDom, type DomHarness } from '../domHarness.test-helper'
import { SpecMediaRecorder, SpecStream } from './participantSpecRecorderFake.test-helper'
import { useParticipantAudioRecorder } from './useParticipantAudioRecorder'

let harness: DomHarness
let api: ReturnType<typeof useParticipantAudioRecorder>
let stream: SpecStream

function Probe() {
  api = useParticipantAudioRecorder()
  return null
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function startAndRecord(): Promise<void> {
  harness.mount(<Probe />)
  await act(async () => {
    void api.start()
  })
  await act(async () => {
    jest.advanceTimersByTime(1000)
  })
}

function hidePage(): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
}

beforeAll(async () => {
  harness = await setupDom()
})

afterAll(() => harness.teardown())

beforeEach(() => {
  jest.useFakeTimers()
  SpecMediaRecorder.instances = []
  stream = new SpecStream()
  ;(globalThis as Record<string, unknown>).MediaRecorder = SpecMediaRecorder
  ;(navigator as unknown as Record<string, unknown>).mediaDevices = { getUserMedia: async () => stream }
  URL.createObjectURL = () => 'blob:fake-recording'
  URL.revokeObjectURL = () => {}
})

afterEach(() => {
  jest.useRealTimers()
  delete (globalThis as Record<string, unknown>).MediaRecorder
})

describe('a recorder that follows the MediaRecorder specification (stop is asynchronous)', () => {
  it('stopping twice still ends in review with the audio', async () => {
    await startAndRecord()
    act(() => {
      api.stop()
      api.stop()
    })
    await flush()
    expect(api.status).toBe('review')
    expect(api.recorded?.file.size).toBe(4096)
    expect(SpecMediaRecorder.instances[0]?.stopCalls).toBe(1)
  })

  it('track.onended after the recorder stopped by itself still ends in review', async () => {
    await startAndRecord()
    SpecMediaRecorder.instances[0]?.autoStop()
    act(() => stream.track.onended?.())
    await flush()
    expect(api.status).toBe('review')
    expect(api.recorded?.file.size).toBe(4096)
  })

  it('the page becoming hidden right after Stop still ends in review', async () => {
    await startAndRecord()
    act(() => api.stop())
    hidePage()
    await flush()
    expect(api.status).toBe('review')
    expect(api.recorded?.file.size).toBe(4096)
  })

  it('the duration ceiling coinciding with Stop still ends in review', async () => {
    await startAndRecord()
    act(() => api.stop())
    await act(async () => {
      jest.advanceTimersByTime(60 * 60 * 1000)
    })
    await flush()
    expect(api.status).toBe('review')
  })
})
