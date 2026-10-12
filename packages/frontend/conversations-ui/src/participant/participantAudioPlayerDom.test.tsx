import { act, useState } from 'react'

import type { ParticipantAttachment } from '@adatechnology/conversation-contracts'
import { describe, expect, it } from 'bun:test'

import { wait } from '../domHarness.test-helper'
import { ATTACHMENT_URL_RETRY_DELAY_MS } from './useStableAttachmentUrl'
import { ParticipantAudioAttachment } from './ParticipantAudioAttachment'
import { DEFAULT_PARTICIPANT_AUDIO_LABELS } from './participantAudioLabels'
import { buildAttachment, setupPlayerDom } from './participantAudioPlayerDomKit.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'

const kit = setupPlayerDom()
const { mountAttachments, audioOf, toggleOf, find, tap } = kit

describe('source: resolved at mount by id, never downloaded before the tap', () => {
  it('assigns the resolved src with preload="none" and resolves once', async () => {
    await mountAttachments([buildAttachment('a')])
    expect(audioOf().getAttribute('src')).toBe('https://files.test/a-1.webm')
    expect(audioOf().getAttribute('preload')).toBe('none')
    expect(audioOf().hasAttribute('controls')).toBe(false)
    expect(kit.resolverCalls).toEqual(['a'])
    expect(kit.media.playCalls).toHaveLength(0)
  })

  it('a list update with a new attachment object and a new URL does not resolve again nor change the src', async () => {
    let setAttachment: (attachment: ParticipantAttachment) => void = () => undefined
    function Harness() {
      const [attachment, update] = useState(buildAttachment('a'))
      setAttachment = update
      return <ParticipantAudioAttachment attachment={attachment} resolveAttachmentUrl={(item) => kit.resolveAttachmentUrl(item)} labels={DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS} />
    }
    kit.container = kit.harness.mount(<Harness />).container
    await wait(0)
    tap(toggleOf())
    kit.media.stateOf(audioOf()).currentTime = 20
    act(() => setAttachment(buildAttachment('a', 65_000)))
    await wait(0)
    expect(kit.resolverCalls).toEqual(['a'])
    expect(audioOf().getAttribute('src')).toBe('https://files.test/a-1.webm')
    expect(kit.media.stateOf(audioOf()).currentTime).toBe(20)
    expect(kit.media.stateOf(audioOf()).paused).toBe(false)
  })

  it('shows the unavailable state when the URL cannot be resolved after the second attempt', async () => {
    await mountAttachments([buildAttachment('a')], async () => {
      throw new Error('nope')
    })
    await wait(ATTACHMENT_URL_RETRY_DELAY_MS + 100)
    expect(kit.container.textContent).toContain(DEFAULT_PARTICIPANT_AUDIO_LABELS.audioUnavailable)
    expect(audioOf().hasAttribute('src')).toBe(false)
  })

  it('a transient failure of the first resolution gets one new attempt before giving up', async () => {
    {
      let attempts = 0
      await mountAttachments([buildAttachment('a')], async () => {
        attempts += 1
        if (attempts === 1) throw new Error('offline for a moment')
        return 'https://files.test/a-retry.webm'
      })
      expect(audioOf().hasAttribute('src')).toBe(false)
      expect(kit.container.querySelector('.cv-p-audio__error')).toBeNull()
      await wait(ATTACHMENT_URL_RETRY_DELAY_MS + 100)
      expect(attempts).toBe(2)
      expect(audioOf().getAttribute('src')).toBe('https://files.test/a-retry.webm')
      expect(kit.container.querySelector('.cv-p-audio__error')).toBeNull()
    }
  })

  it('says it with static text: no alert role (N failing players would be N assertive announcements) and a disabled toggle', async () => {
    await mountAttachments([buildAttachment('a'), buildAttachment('b')], async () => {
      throw new Error('nope')
    })
    await wait(ATTACHMENT_URL_RETRY_DELAY_MS + 100)
    const messages = kit.container.querySelectorAll('.cv-p-audio__error')
    expect(messages).toHaveLength(2)
    for (const message of Array.from(messages)) expect(message.hasAttribute('role')).toBe(false)
    expect(kit.container.querySelector('[role="alert"]')).toBeNull()
    expect(toggleOf().disabled).toBe(true)
  })

  it('puts the file name after the player', async () => {
    await mountAttachments([buildAttachment('a')])
    const wrapper = find('.cv-p-attachment--audio')
    expect(wrapper.firstElementChild?.className).toBe('cv-p-audio')
    expect(wrapper.lastElementChild?.className).toBe('cv-p-attachment__name')
    expect(kit.container.querySelector('.cv-p-attachment__audio')).toBeNull()
  })
})

describe('play and pause', () => {
  it('calls play() synchronously in the tap (a play after an await loses the iOS gesture)', async () => {
    await mountAttachments([buildAttachment('a')])
    tap(toggleOf())
    expect(kit.media.playCalls).toHaveLength(1)
    expect(kit.media.playCalls[0] === audioOf()).toBe(true)
    expect(toggleOf().getAttribute('aria-label')).toBe('Pause audio')
    tap(toggleOf())
    expect(toggleOf().getAttribute('aria-label')).toBe('Play audio')
  })

  it('stays on "Play audio" when the browser refuses play()', async () => {
    await mountAttachments([buildAttachment('a')])
    kit.media.playOutcome = 'reject'
    tap(toggleOf())
    await wait(0)
    expect(toggleOf().getAttribute('aria-label')).toBe('Play audio')
  })

  it('playing one audio pauses the other', async () => {
    await mountAttachments([buildAttachment('a'), buildAttachment('b')])
    tap(toggleOf(0))
    tap(toggleOf(1))
    expect(kit.media.pauseCalls).toHaveLength(1)
    expect(kit.media.pauseCalls[0] === audioOf(0)).toBe(true)
    expect(toggleOf(0).getAttribute('aria-label')).toBe('Play audio')
    expect(toggleOf(1).getAttribute('aria-label')).toBe('Pause audio')
  })

  it('the toggle is at least the touch size and a plain button', async () => {
    await mountAttachments([buildAttachment('a')])
    expect(toggleOf().getAttribute('type')).toBe('button')
  })
})
