import { act } from 'react'

import { describe, expect, it } from 'bun:test'

import { setupRecorderDom } from './participantRecorderDomKit.test-helper'

const kit = setupRecorderDom()
const { mountProbe, start, advance, recordFor, deferStream, hidePage } = kit

describe('the duration ceiling', () => {
  it('stops by itself at the ceiling and lands in review', async () => {
    mountProbe({ maxDurationMs: 2000 })
    await recordFor(1000)
    expect(kit.api.status).toBe('recording')
    await advance(1100)
    expect(kit.api.status).toBe('review')
  })

  it('shows the elapsed time while recording', async () => {
    mountProbe()
    await recordFor(3000)
    expect(kit.api.elapsedMs).toBeGreaterThanOrEqual(2750)
  })
})

describe('cancellation token of getUserMedia (contract 2.1)', () => {
  it('unmount while requesting: a late stream gets every track stopped at once', async () => {
    deferStream()
    const tree = mountProbe()
    await start()
    tree.unmount()
    await act(async () => kit.resolveStream?.(kit.stream))
    expect(kit.stream.track.stopCount).toBe(1)
  })

  it('page hidden while requesting: back to idle and the late kit.stream is stopped', async () => {
    deferStream()
    mountProbe()
    await start()
    hidePage()
    expect(kit.api.status).toBe('idle')
    await act(async () => kit.resolveStream?.(kit.stream))
    expect(kit.stream.track.stopCount).toBe(1)
    expect(kit.api.status).toBe('idle')
  })

  it('pagehide while requesting also cancels', async () => {
    deferStream()
    mountProbe()
    await start()
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    await act(async () => kit.resolveStream?.(kit.stream))
    expect(kit.stream.track.stopCount).toBe(1)
    expect(kit.api.status).toBe('idle')
  })
})

describe('interruptions (contract 2.1)', () => {
  it('track.onended while recording stops and goes to review', async () => {
    mountProbe()
    await recordFor(1000)
    act(() => kit.stream.track.onended?.())
    expect(kit.api.status).toBe('review')
  })

  it('a mute shorter than 3 s does not interrupt', async () => {
    mountProbe()
    await recordFor(1000)
    act(() => kit.stream.track.onmute?.())
    await advance(2900)
    act(() => kit.stream.track.onunmute?.())
    await advance(5000)
    expect(kit.api.status).toBe('recording')
  })

  it('a mute that persists past 3 s interrupts', async () => {
    mountProbe()
    await recordFor(1000)
    act(() => kit.stream.track.onmute?.())
    await advance(2900)
    expect(kit.api.status).toBe('recording')
    await advance(200)
    expect(kit.api.status).toBe('review')
  })

  it('page hidden while recording stops and goes to review', async () => {
    mountProbe()
    await recordFor(1000)
    hidePage()
    expect(kit.api.status).toBe('review')
  })

  it('pagehide while recording stops and goes to review', async () => {
    mountProbe()
    await recordFor(1000)
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(kit.api.status).toBe('review')
  })

  it('page hidden in review pauses the player and KEEPS the recording', async () => {
    mountProbe()
    await recordFor(1000)
    act(() => kit.api.stop())
    let paused = 0
    ;(kit.api.audioRef as { current: unknown }).current = { pause: () => (paused += 1) }
    hidePage()
    expect(paused).toBe(1)
    expect(kit.api.status).toBe('review')
    expect(kit.api.recorded?.file.size).toBe(4096)
    expect(kit.revoked).toEqual([])
  })
})

describe('unmount discards everything', () => {
  it('while recording: tracks stopped, capture reported off', async () => {
    const tree = mountProbe()
    await recordFor(1000)
    tree.unmount()
    expect(kit.stream.track.stopCount).toBeGreaterThan(0)
    expect(kit.captureEvents.at(-1)).toBe(false)
  })

  it('in review: the object URL is revoked', async () => {
    const tree = mountProbe()
    await recordFor(1000)
    act(() => kit.api.stop())
    tree.unmount()
    expect(kit.revoked).toEqual(['blob:fake-recording'])
    expect(kit.captureEvents.at(-1)).toBe(false)
  })
})
