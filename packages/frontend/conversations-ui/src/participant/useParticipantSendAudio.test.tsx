import { act } from 'react'

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

import { setupDom, type DomHarness } from '../domHarness.test-helper'
import type { ParticipantSendContent } from './participantDrafts'
import { useParticipantSendAudio } from './useParticipantSendAudio'

let harness: DomHarness
let sendAudio: (file: File) => void
let calls: ParticipantSendContent[]
let releases: Array<() => void>

function Probe() {
  sendAudio = useParticipantSendAudio((content) => {
    calls.push(content)
    return new Promise<void>((resolve) => releases.push(resolve))
  })
  return null
}

beforeAll(async () => {
  harness = await setupDom()
})

afterAll(() => harness.teardown())

function mountProbe(): void {
  calls = []
  releases = []
  harness.mount(<Probe />)
}

const audio = (name: string) => new File(['x'], name, { type: 'audio/ogg' })

describe('useParticipantSendAudio', () => {
  it('sends the file alone, as a message of its own', () => {
    mountProbe()
    const file = audio('a.ogg')
    sendAudio(file)
    expect(calls).toEqual([{ files: [file] }])
  })

  it('ignores a second synchronous send of the same file', () => {
    mountProbe()
    const file = audio('a.ogg')
    sendAudio(file)
    sendAudio(file)
    expect(calls).toHaveLength(1)
  })

  it('lets another recording through while the first is still uploading, and the same one again once it settled', async () => {
    mountProbe()
    const first = audio('a.ogg')
    sendAudio(first)
    sendAudio(audio('b.ogg'))
    expect(calls).toHaveLength(2)
    await act(async () => releases[0]?.())
    sendAudio(first)
    expect(calls).toHaveLength(3)
  })
})
