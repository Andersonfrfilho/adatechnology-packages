import type { ComponentType } from 'react'

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

import { setupDom, type DomHarness } from '../domHarness.test-helper'
import { buildThreadProps } from './participantGoldenScenarios.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { ParticipantThread } from './ParticipantThread'

const UntypedThread = ParticipantThread as unknown as ComponentType<Record<string, unknown>>

describe('empty composer in a recording browser without the audioRecording prop (contract 2.4 item 3)', () => {
  let harness: DomHarness

  beforeAll(async () => {
    harness = await setupDom()
    const globals = globalThis as Record<string, unknown>
    globals.MediaRecorder = class FakeMediaRecorder {
      static isTypeSupported(): boolean {
        return true
      }
    }
    ;(navigator as unknown as Record<string, unknown>).mediaDevices = { getUserMedia: async () => ({ getTracks: () => [] }) }
  })

  afterAll(() => {
    delete (globalThis as Record<string, unknown>).MediaRecorder
    harness.teardown()
  })

  it('renders no microphone button even though MediaRecorder and getUserMedia exist', () => {
    const props = {
      ...buildThreadProps(DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS),
      draft: { value: '', onChange: () => undefined, files: [], onFilesChange: () => undefined },
    }
    const { container } = harness.mount(<UntypedThread {...props} />)

    expect(typeof (globalThis as Record<string, unknown>).MediaRecorder).toBe('function')
    expect(container.querySelector('.cv-p-composer__send') !== null).toBe(true)
    expect(container.querySelector('.cv-p-composer__record') === null).toBe(true)
    expect(container.querySelector('button[aria-label="Record audio"]') === null).toBe(true)
    expect(Array.from(container.querySelectorAll('button')).some((button) => /record/i.test(button.getAttribute('aria-label') ?? ''))).toBe(false)
  })
})
