import { act } from 'react'

import type { ParticipantAttachment } from '@adatechnology/conversation-contracts'
import { afterAll, afterEach, beforeAll, beforeEach } from 'bun:test'

import { setupDom, wait, type DomHarness } from '../domHarness.test-helper'
import { ParticipantAudioAttachment } from './ParticipantAudioAttachment'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { installFakeMedia, type FakeMediaControls } from './participantMediaFakes.test-helper'

export type PlayerDomKit = {
  harness: DomHarness
  media: FakeMediaControls
  container: HTMLElement
  resolverCalls: string[]
  urlSequence: string[]
  resolveAttachmentUrl: (attachment: ParticipantAttachment) => Promise<string>
  mountAttachments: (attachments: ParticipantAttachment[], resolver?: PlayerDomKit['resolveAttachmentUrl']) => Promise<void>
  audioOf: (index?: number) => HTMLAudioElement
  toggleOf: (index?: number) => HTMLButtonElement
  find: <TElement extends Element>(selector: string) => TElement
  tap: (element: Element) => void
}

export function buildAttachment(id: string, durationMs?: number): ParticipantAttachment {
  return { id, kind: 'audio', filename: `${id}.webm`, mimeType: 'audio/webm', sizeBytes: 2048, ...(durationMs === undefined ? {} : { durationMs }) } as ParticipantAttachment
}

export function setupPlayerDom(): PlayerDomKit {
  const kit: PlayerDomKit = {
    resolveAttachmentUrl: async (attachment) => {
      kit.resolverCalls.push(attachment.id)
      const url = kit.urlSequence[kit.resolverCalls.filter((id) => id === attachment.id).length - 1]
      if (!url) throw new Error('unavailable')
      return attachment.id === 'b' ? 'https://files.test/b-1.webm' : url
    },
    mountAttachments: async (attachments, resolver = kit.resolveAttachmentUrl) => {
      kit.container = kit.harness.mount(
        <>
          {attachments.map((attachment) => (
            <ParticipantAudioAttachment key={attachment.id} attachment={attachment} resolveAttachmentUrl={resolver} labels={DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS} />
          ))}
        </>,
      ).container
      await wait(0)
    },
    audioOf: (index = 0) => {
      const audio = kit.container.querySelectorAll<HTMLAudioElement>('audio')[index]
      if (!audio) throw new Error('missing audio')
      return audio
    },
    toggleOf: (index = 0) => {
      const toggle = kit.container.querySelectorAll<HTMLButtonElement>('.cv-p-audio__toggle')[index]
      if (!toggle) throw new Error('missing toggle')
      return toggle
    },
    find: <TElement extends Element>(selector: string): TElement => {
      const element = kit.container.querySelector<TElement>(selector)
      if (!element) throw new Error(`missing ${selector}`)
      return element
    },
    tap: (element) => {
      act(() => {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
    },
  } as PlayerDomKit

  beforeAll(async () => {
    kit.harness = await setupDom()
  })

  afterAll(() => kit.harness.teardown())

  beforeEach(() => {
    kit.media = installFakeMedia()
    kit.resolverCalls = []
    kit.urlSequence = ['https://files.test/a-1.webm', 'https://files.test/a-2.webm', 'https://files.test/a-3.webm']
  })

  afterEach(() => kit.media.restore())

  return kit
}
