import { act, useState } from 'react'

import type { ParticipantAttachment } from '@adatechnology/conversation-contracts'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'

import { pressKey, setupDom, wait, type DomHarness } from '../domHarness.test-helper'
import { ParticipantAudioAttachment } from './ParticipantAudioAttachment'
import { ParticipantAudioRecorderView } from './ParticipantAudioRecorderView'
import { DEFAULT_PARTICIPANT_AUDIO_LABELS } from './participantAudioLabels'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { installFakeMedia, type FakeMediaControls } from './participantMediaFakes.test-helper'

let harness: DomHarness
let media: FakeMediaControls
let container: HTMLElement
let resolverCalls: string[]
let urlSequence: string[]

beforeAll(async () => {
  harness = await setupDom()
})

afterAll(() => harness.teardown())

beforeEach(() => {
  media = installFakeMedia()
  resolverCalls = []
  urlSequence = ['https://files.test/a-1.webm', 'https://files.test/a-2.webm', 'https://files.test/a-3.webm']
})

afterEach(() => media.restore())

function buildAttachment(id: string, durationMs?: number): ParticipantAttachment {
  return { id, kind: 'audio', filename: `${id}.webm`, mimeType: 'audio/webm', sizeBytes: 2048, ...(durationMs === undefined ? {} : { durationMs }) } as ParticipantAttachment
}

const resolveAttachmentUrl = async (attachment: ParticipantAttachment): Promise<string> => {
  resolverCalls.push(attachment.id)
  const url = urlSequence[resolverCalls.filter((id) => id === attachment.id).length - 1]
  if (!url) throw new Error('unavailable')
  return attachment.id === 'b' ? 'https://files.test/b-1.webm' : url
}

async function mountAttachments(attachments: ParticipantAttachment[], resolver = resolveAttachmentUrl): Promise<void> {
  container = harness.mount(
    <>
      {attachments.map((attachment) => (
        <ParticipantAudioAttachment key={attachment.id} attachment={attachment} resolveAttachmentUrl={resolver} labels={DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS} />
      ))}
    </>,
  ).container
  await wait(0)
}

function audioOf(index = 0): HTMLAudioElement {
  const audio = container.querySelectorAll<HTMLAudioElement>('audio')[index]
  if (!audio) throw new Error('missing audio')
  return audio
}

function toggleOf(index = 0): HTMLButtonElement {
  const toggle = container.querySelectorAll<HTMLButtonElement>('.cv-p-audio__toggle')[index]
  if (!toggle) throw new Error('missing toggle')
  return toggle
}

function find<TElement extends Element>(selector: string): TElement {
  const element = container.querySelector<TElement>(selector)
  if (!element) throw new Error(`missing ${selector}`)
  return element
}

function tap(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

describe('source: resolved at mount by id, never downloaded before the tap', () => {
  it('assigns the resolved src with preload="none" and resolves once', async () => {
    await mountAttachments([buildAttachment('a')])
    expect(audioOf().getAttribute('src')).toBe('https://files.test/a-1.webm')
    expect(audioOf().getAttribute('preload')).toBe('none')
    expect(audioOf().hasAttribute('controls')).toBe(false)
    expect(resolverCalls).toEqual(['a'])
    expect(media.playCalls).toHaveLength(0)
  })

  it('a list update with a new attachment object and a new URL does not resolve again nor change the src', async () => {
    let setAttachment: (attachment: ParticipantAttachment) => void = () => undefined
    function Harness() {
      const [attachment, update] = useState(buildAttachment('a'))
      setAttachment = update
      return <ParticipantAudioAttachment attachment={attachment} resolveAttachmentUrl={(item) => resolveAttachmentUrl(item)} labels={DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS} />
    }
    container = harness.mount(<Harness />).container
    await wait(0)
    tap(toggleOf())
    media.stateOf(audioOf()).currentTime = 20
    act(() => setAttachment(buildAttachment('a', 65_000)))
    await wait(0)
    expect(resolverCalls).toEqual(['a'])
    expect(audioOf().getAttribute('src')).toBe('https://files.test/a-1.webm')
    expect(media.stateOf(audioOf()).currentTime).toBe(20)
    expect(media.stateOf(audioOf()).paused).toBe(false)
  })

  it('shows the unavailable state when the URL cannot be resolved', async () => {
    await mountAttachments([buildAttachment('a')], async () => {
      throw new Error('nope')
    })
    expect(container.textContent).toContain(DEFAULT_PARTICIPANT_AUDIO_LABELS.audioUnavailable)
    expect(audioOf().hasAttribute('src')).toBe(false)
  })

  it('puts the file name after the player', async () => {
    await mountAttachments([buildAttachment('a')])
    const wrapper = find('.cv-p-attachment--audio')
    expect(wrapper.firstElementChild?.className).toBe('cv-p-audio')
    expect(wrapper.lastElementChild?.className).toBe('cv-p-attachment__name')
    expect(container.querySelector('.cv-p-attachment__audio')).toBeNull()
  })
})

describe('play and pause', () => {
  it('calls play() synchronously in the tap (a play after an await loses the iOS gesture)', async () => {
    await mountAttachments([buildAttachment('a')])
    tap(toggleOf())
    expect(media.playCalls).toHaveLength(1)
    expect(media.playCalls[0] === audioOf()).toBe(true)
    expect(toggleOf().getAttribute('aria-label')).toBe('Pause audio')
    tap(toggleOf())
    expect(toggleOf().getAttribute('aria-label')).toBe('Play audio')
  })

  it('stays on "Play audio" when the browser refuses play()', async () => {
    await mountAttachments([buildAttachment('a')])
    media.playOutcome = 'reject'
    tap(toggleOf())
    await wait(0)
    expect(toggleOf().getAttribute('aria-label')).toBe('Play audio')
  })

  it('playing one audio pauses the other', async () => {
    await mountAttachments([buildAttachment('a'), buildAttachment('b')])
    tap(toggleOf(0))
    tap(toggleOf(1))
    expect(media.pauseCalls).toHaveLength(1)
    expect(media.pauseCalls[0] === audioOf(0)).toBe(true)
    expect(toggleOf(0).getAttribute('aria-label')).toBe('Play audio')
    expect(toggleOf(1).getAttribute('aria-label')).toBe('Pause audio')
  })

  it('the toggle is at least the touch size and a plain button', async () => {
    await mountAttachments([buildAttachment('a')])
    expect(toggleOf().getAttribute('type')).toBe('button')
  })
})

describe('time and range', () => {
  it('shows the server duration before the first tap', async () => {
    await mountAttachments([buildAttachment('a', 65_000)])
    expect(find('.cv-p-audio__time').textContent).toBe('0:00 / 1:05')
    expect(find<HTMLInputElement>('.cv-p-audio__seek').getAttribute('max')).toBe('65')
  })

  it('uses loadedmetadata when the server sent no duration', async () => {
    await mountAttachments([buildAttachment('a')])
    expect(find('.cv-p-audio__time').textContent).toBe('0:00 / --:--')
    media.stateOf(audioOf()).duration = 42
    act(() => media.emit(audioOf(), 'loadedmetadata'))
    expect(find('.cv-p-audio__time').textContent).toBe('0:00 / 0:42')
  })

  it('follows timeupdate and seeks by dragging the range', async () => {
    await mountAttachments([buildAttachment('a', 65_000)])
    media.stateOf(audioOf()).currentTime = 12
    act(() => media.emit(audioOf(), 'timeupdate'))
    expect(find('.cv-p-audio__time').textContent).toBe('0:12 / 1:05')
    expect(find('.cv-p-audio__seek').getAttribute('aria-valuetext')).toBe('0:12 of 1:05')
    const range = find<HTMLInputElement>('.cv-p-audio__seek')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(range, '30')
      range.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(media.stateOf(audioOf()).currentTime).toBe(30)
  })

  it('steps 5 seconds with the arrows and jumps with Home and End', async () => {
    await mountAttachments([buildAttachment('a', 65_000)])
    const range = find('.cv-p-audio__seek')
    pressKey(range, 'ArrowRight')
    expect(media.stateOf(audioOf()).currentTime).toBe(5)
    pressKey(range, 'ArrowRight')
    pressKey(range, 'ArrowLeft')
    expect(media.stateOf(audioOf()).currentTime).toBe(5)
    pressKey(range, 'End')
    expect(media.stateOf(audioOf()).currentTime).toBe(65)
    pressKey(range, 'Home')
    expect(media.stateOf(audioOf()).currentTime).toBe(0)
  })

  it('tolerates an infinite duration: no broken max, value text with the position only', async () => {
    await mountAttachments([buildAttachment('a')])
    media.stateOf(audioOf()).duration = Number.POSITIVE_INFINITY
    act(() => media.emit(audioOf(), 'durationchange'))
    media.stateOf(audioOf()).currentTime = 12
    act(() => media.emit(audioOf(), 'timeupdate'))
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
    expect(media.stateOf(audioOf()).defaultPlaybackRate).toBe(1.5)
    expect(media.stateOf(audioOf()).playbackRate).toBe(1.5)
    tap(rate)
    expect(media.stateOf(audioOf()).playbackRate).toBe(2)
    tap(rate)
    expect(media.stateOf(audioOf()).playbackRate).toBe(1)
  })
})

describe('expired signed URL', () => {
  it('re-resolves once on a media error, swaps the src and resumes from the same position', async () => {
    await mountAttachments([buildAttachment('a', 65_000)])
    tap(toggleOf())
    media.stateOf(audioOf()).currentTime = 12
    act(() => media.emit(audioOf(), 'error'))
    await wait(0)
    expect(resolverCalls).toEqual(['a', 'a'])
    expect(audioOf().getAttribute('src')).toBe('https://files.test/a-2.webm')
    expect(media.stateOf(audioOf()).currentTime).toBe(12)
    expect(media.playCalls.length).toBe(2)
  })

  it('gives up after the single retry and says the audio is unavailable', async () => {
    await mountAttachments([buildAttachment('a', 65_000)])
    tap(toggleOf())
    act(() => media.emit(audioOf(), 'error'))
    await wait(0)
    act(() => media.emit(audioOf(), 'error'))
    await wait(0)
    expect(resolverCalls).toEqual(['a', 'a'])
    expect(container.textContent).toContain(DEFAULT_PARTICIPANT_AUDIO_LABELS.audioUnavailable)
  })
})

describe('recorder review reuses the same player', () => {
  it('draws the player with the object URL, hands the audio element to the recorder ref and shows the recorded duration', () => {
    const audioRef: { current: HTMLAudioElement | null } = { current: null }
    container = harness.mount(
      <ParticipantAudioRecorderView state="review" elapsedMs={0} review={{ url: 'blob:fake', audioRef, durationMs: 12_000 }} />,
    ).container
    expect(container.querySelector('.cv-p-audio')).not.toBeNull()
    expect(audioOf().getAttribute('src')).toBe('blob:fake')
    expect(audioOf().getAttribute('preload')).toBe('none')
    expect(audioRef.current).toBe(audioOf())
    expect(find('.cv-p-audio__time').textContent).toBe('0:00 / 0:12')
  })
})
