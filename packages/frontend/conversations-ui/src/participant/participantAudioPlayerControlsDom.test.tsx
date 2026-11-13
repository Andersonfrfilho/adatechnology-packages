import { act } from 'react'

import { describe, expect, it } from 'bun:test'

import { pressKey, wait } from '../domHarness.test-helper'
import { ParticipantAudioRecorderView } from './ParticipantAudioRecorderView'
import { DEFAULT_PARTICIPANT_AUDIO_LABELS } from './participantAudioLabels'
import { buildAttachment, setupPlayerDom } from './participantAudioPlayerDomKit.test-helper'

const kit = setupPlayerDom()
const { mountAttachments, audioOf, toggleOf, find, tap } = kit

describe('time and range', () => {
  it('shows the server duration before the first tap', async () => {
    await mountAttachments([buildAttachment('a', 65_000)])
    expect(find('.cv-p-audio__time').textContent).toBe('0:00 / 1:05')
    expect(find<HTMLInputElement>('.cv-p-audio__seek').getAttribute('max')).toBe('65')
  })

  it('uses loadedmetadata when the server sent no duration', async () => {
    await mountAttachments([buildAttachment('a')])
    expect(find('.cv-p-audio__time').textContent).toBe('0:00 / --:--')
    kit.media.stateOf(audioOf()).duration = 42
    act(() => kit.media.emit(audioOf(), 'loadedmetadata'))
    expect(find('.cv-p-audio__time').textContent).toBe('0:00 / 0:42')
  })

  it('follows timeupdate and seeks by dragging the range', async () => {
    await mountAttachments([buildAttachment('a', 65_000)])
    kit.media.stateOf(audioOf()).currentTime = 12
    act(() => kit.media.emit(audioOf(), 'timeupdate'))
    expect(find('.cv-p-audio__time').textContent).toBe('0:12 / 1:05')
    expect(find('.cv-p-audio__seek').getAttribute('aria-valuetext')).toBe('0:12 of 1:05')
    const range = find<HTMLInputElement>('.cv-p-audio__seek')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(range, '30')
      range.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(kit.media.stateOf(audioOf()).currentTime).toBe(30)
  })

  it('steps 5 seconds with the arrows and jumps with Home and End', async () => {
    await mountAttachments([buildAttachment('a', 65_000)])
    const range = find('.cv-p-audio__seek')
    pressKey(range, 'ArrowRight')
    expect(kit.media.stateOf(audioOf()).currentTime).toBe(5)
    pressKey(range, 'ArrowRight')
    pressKey(range, 'ArrowLeft')
    expect(kit.media.stateOf(audioOf()).currentTime).toBe(5)
    pressKey(range, 'End')
    expect(kit.media.stateOf(audioOf()).currentTime).toBe(65)
    pressKey(range, 'Home')
    expect(kit.media.stateOf(audioOf()).currentTime).toBe(0)
  })

  it('tolerates an infinite duration: no broken max, value text with the position only', async () => {
    await mountAttachments([buildAttachment('a')])
    kit.media.stateOf(audioOf()).duration = Number.POSITIVE_INFINITY
    act(() => kit.media.emit(audioOf(), 'durationchange'))
    kit.media.stateOf(audioOf()).currentTime = 12
    act(() => kit.media.emit(audioOf(), 'timeupdate'))
    const range = find('.cv-p-audio__seek')
    expect(range.getAttribute('max')).toBe('12')
    expect(range.getAttribute('aria-valuetext')).toBe('0:12')
    expect(find('.cv-p-audio__time').textContent).toBe('0:12 / --:--')
  })
})

describe('speed', () => {
  it('cycles 1x, 1.5x, 2x applying defaultPlaybackRate and playbackRate', async () => {
    await mountAttachments([buildAttachment('a')])
    const rate = find('.cv-p-audio__rate')
    expect(rate.textContent).toBe('1×')
    tap(rate)
    expect(rate.textContent).toBe('1.5×')
    expect(rate.getAttribute('aria-label')).toBe('Playback speed 1.5×')
    expect(kit.media.stateOf(audioOf()).defaultPlaybackRate).toBe(1.5)
    expect(kit.media.stateOf(audioOf()).playbackRate).toBe(1.5)
    tap(rate)
    expect(kit.media.stateOf(audioOf()).playbackRate).toBe(2)
    tap(rate)
    expect(kit.media.stateOf(audioOf()).playbackRate).toBe(1)
  })
})

describe('expired signed URL', () => {
  it('re-resolves once on a media error, swaps the src and resumes from the same position', async () => {
    await mountAttachments([buildAttachment('a', 65_000)])
    tap(toggleOf())
    kit.media.stateOf(audioOf()).currentTime = 12
    act(() => kit.media.emit(audioOf(), 'error'))
    await wait(0)
    expect(kit.resolverCalls).toEqual(['a', 'a'])
    expect(audioOf().getAttribute('src')).toBe('https://files.test/a-2.webm')
    expect(kit.media.stateOf(audioOf()).currentTime).toBe(12)
    expect(kit.media.playCalls.length).toBe(2)
  })

  it('gives up after the single retry and says the audio is unavailable', async () => {
    await mountAttachments([buildAttachment('a', 65_000)])
    tap(toggleOf())
    act(() => kit.media.emit(audioOf(), 'error'))
    await wait(0)
    act(() => kit.media.emit(audioOf(), 'error'))
    await wait(0)
    expect(kit.resolverCalls).toEqual(['a', 'a'])
    expect(kit.container.textContent).toContain(DEFAULT_PARTICIPANT_AUDIO_LABELS.audioUnavailable)
  })
})

describe('recorder review reuses the same player', () => {
  it('draws the player with the object URL, hands the audio element to the recorder ref and shows the recorded duration', () => {
    const audioRef: { current: HTMLAudioElement | null } = { current: null }
    kit.container = kit.harness.mount(
      <ParticipantAudioRecorderView state="review" elapsedMs={0} review={{ url: 'blob:fake', audioRef, durationMs: 12_000 }} />,
    ).container
    expect(kit.container.querySelector('.cv-p-audio')).not.toBeNull()
    expect(audioOf().getAttribute('src')).toBe('blob:fake')
    expect(audioOf().getAttribute('preload')).toBe('none')
    expect(audioRef.current).toBe(audioOf())
    expect(find('.cv-p-audio__time').textContent).toBe('0:00 / 0:12')
  })
})
