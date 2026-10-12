import { act } from 'react'

import { describe, expect, it } from 'bun:test'

import { setupRecorderDom } from './participantRecorderDomKit.test-helper'

const kit = setupRecorderDom()
const { mountProbe, start, advance, recordFor, deferStream } = kit

describe('the happy path', () => {
  it('goes idle -> requesting -> recording -> review with a coherent File', async () => {
    mountProbe()
    expect(kit.api.status).toBe('idle')
    deferStream()
    await start()
    expect(kit.api.status).toBe('requesting')
    await act(async () => kit.resolveStream?.(kit.stream))
    expect(kit.api.status).toBe('recording')
    await advance(1500)
    act(() => kit.api.stop())
    expect(kit.api.status).toBe('review')
    expect(kit.api.recorded?.file.type).toBe('audio/ogg')
    expect(kit.api.recorded?.file.name).toMatch(/^audio-\d{8}-\d{6}\.ogg$/)
    expect(kit.api.recorded?.file.size).toBe(4096)
    expect(kit.api.recorded?.objectUrl).toBe('blob:fake-recording')
    expect(kit.stream.track.stopCount).toBeGreaterThan(0)
  })

  it('falls back to m4a with the matching mime type', async () => {
    kit.supportedTypes = ['audio/mp4']
    mountProbe()
    await recordFor(1000)
    act(() => kit.api.stop())
    expect(kit.api.recorded?.file.name).toMatch(/\.m4a$/)
    expect(kit.api.recorded?.file.type).toBe('audio/mp4')
  })

  it('reports capture from requesting until it leaves review, and revokes the URL on every exit', async () => {
    mountProbe()
    await recordFor(1000)
    act(() => kit.api.stop())
    expect(kit.captureEvents).toEqual([true])
    let file: File | undefined
    act(() => {
      file = kit.api.confirm()
    })
    expect(file?.size).toBe(4096)
    expect(kit.api.status).toBe('idle')
    expect(kit.revoked).toEqual(['blob:fake-recording'])
    expect(kit.captureEvents).toEqual([true, false])
  })

  it('discard from review revokes the URL and returns to idle', async () => {
    mountProbe()
    await recordFor(1000)
    act(() => kit.api.stop())
    act(() => kit.api.discard())
    expect(kit.api.status).toBe('idle')
    expect(kit.revoked).toEqual(['blob:fake-recording'])
  })

  it('discard while recording stops the track and records nothing', async () => {
    mountProbe()
    await recordFor(1000)
    act(() => kit.api.discard())
    expect(kit.api.status).toBe('idle')
    expect(kit.stream.track.stopCount).toBeGreaterThan(0)
    expect(kit.api.recorded).toBeUndefined()
  })
})

describe('failures', () => {
  it('permission denied -> denied, and the next tap asks again', async () => {
    kit.getUserMediaImpl = () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' }))
    mountProbe()
    await start()
    expect(kit.api.status).toBe('denied')
    kit.getUserMediaImpl = async () => kit.stream
    await start()
    expect(kit.api.status).toBe('recording')
  })

  it('no microphone device -> unsupported', async () => {
    kit.getUserMediaImpl = () => Promise.reject(Object.assign(new Error('x'), { name: 'NotFoundError' }))
    mountProbe()
    await start()
    expect(kit.api.status).toBe('unsupported')
  })

  it('no MediaRecorder at all -> unsupported without asking for the microphone', async () => {
    delete (globalThis as Record<string, unknown>).MediaRecorder
    let asked = false
    kit.getUserMediaImpl = async () => {
      asked = true
      return kit.stream
    }
    mountProbe()
    await start()
    expect(kit.api.status).toBe('unsupported')
    expect(asked).toBe(false)
  })

  it('a recording with no bytes -> empty, tracks released', async () => {
    kit.chunkBytes = 0
    mountProbe()
    await recordFor(1000)
    act(() => kit.api.stop())
    expect(kit.api.status).toBe('empty')
    expect(kit.stream.track.stopCount).toBeGreaterThan(0)
    expect(kit.revoked).toEqual([])
  })

  it('stopping before the minimum duration -> empty', async () => {
    mountProbe()
    await recordFor(100)
    act(() => kit.api.stop())
    expect(kit.api.status).toBe('empty')
  })

  it('above the byte ceiling -> tooLarge, nothing kept', async () => {
    mountProbe({ maxSizeBytes: 1000 })
    await recordFor(1000)
    act(() => kit.api.stop())
    expect(kit.api.status).toBe('tooLarge')
    expect(kit.api.recorded).toBeUndefined()
  })
})
