import { act } from 'react'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest, mock } from 'bun:test'

import { setupDom, type DomHarness } from '../domHarness.test-helper'
import { ConversationThread } from './ConversationThread'
import { ParticipantComposer, type ParticipantComposerProps } from './ParticipantComposer'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { installFakeRecording, type FakeRecordingControls } from './participantRecorderFakes.test-helper'

let harness: DomHarness
let fakes: FakeRecordingControls
let container: HTMLElement
let sentAudio: File[]
let draftTouches: string[]
let captureEvents: boolean[]

beforeAll(async () => {
  harness = await setupDom()
})

afterAll(() => harness.teardown())

beforeEach(() => {
  jest.useFakeTimers()
  fakes = installFakeRecording()
  URL.createObjectURL = () => 'blob:fake-recording'
  URL.revokeObjectURL = () => undefined
  sentAudio = []
  draftTouches = []
  captureEvents = []
})

afterEach(() => {
  jest.useRealTimers()
  fakes.restore()
})

function mountComposer(overrides: Partial<ParticipantComposerProps> = {}): void {
  const props: ParticipantComposerProps = {
    value: '',
    onChange: () => draftTouches.push('onChange'),
    files: [],
    onFilesChange: () => draftTouches.push('onFilesChange'),
    onSend: () => draftTouches.push('onSend'),
    labels: DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS,
    audioRecording: { onCaptureChange: (isCapturing) => captureEvents.push(isCapturing) },
    onSendAudio: (file) => sentAudio.push(file),
    ...overrides,
  }
  container = harness.mount(<ParticipantComposer {...props} />).container
}

function find(selector: string): HTMLButtonElement {
  const element = container.querySelector<HTMLButtonElement>(selector)
  if (!element) throw new Error(`missing ${selector}`)
  return element
}

async function press(selector: string): Promise<void> {
  await act(async () => find(selector).click())
}

async function recordFor(milliseconds: number): Promise<void> {
  await press('.cv-p-composer__record')
  await act(async () => jest.advanceTimersByTime(milliseconds))
  await press('.cv-p-recorder__stop')
}

describe('record, review and send from the composer', () => {
  it('sends exactly one audio File and never touches the text draft or the attached files', async () => {
    mountComposer()
    await recordFor(1500)
    expect(find('.cv-p-recorder--review')).toBeTruthy()
    await press('.cv-p-recorder__send')

    expect(sentAudio).toHaveLength(1)
    expect(sentAudio[0]?.name).toMatch(/^audio-\d{8}-\d{6}\.ogg$/)
    expect(sentAudio[0]?.type).toBe('audio/ogg')
    expect(draftTouches).toEqual([])
    expect(container.querySelector('.cv-p-composer__record')).not.toBeNull()
  })

  it('shows the recorder row in place of the field while recording, with the error above the row when idle', async () => {
    mountComposer()
    await press('.cv-p-composer__record')
    expect(container.querySelector('.cv-p-composer__input')).toBeNull()
    expect(find('.cv-p-recorder[role="group"]')).toBeTruthy()
    expect(container.querySelector('[role="timer"]')?.textContent).toBe('0:00 of 5:00')
  })

  it('turns two synchronous clicks on "Send audio" into one message', async () => {
    mountComposer()
    await recordFor(1500)
    const sendButton = find('.cv-p-recorder__send')
    await act(async () => {
      sendButton.click()
      sendButton.click()
    })
    expect(sentAudio).toHaveLength(1)
  })

  it('refuses an audio over the size ceiling before sending, with the message above the microphone', async () => {
    mountComposer({ audioRecording: { maxSizeBytes: 1000 } })
    await recordFor(1500)
    expect(sentAudio).toHaveLength(0)
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS.audioTooLarge)
    expect(container.querySelector('.cv-p-composer__record')).not.toBeNull()
  })

  it('refuses an empty capture before sending', async () => {
    fakes.chunkBytes = 0
    mountComposer()
    await recordFor(1500)
    expect(sentAudio).toHaveLength(0)
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS.audioEmpty)
  })

  it('keeps the microphone disabled together with the composer', async () => {
    mountComposer({ disabled: true })
    expect(find('.cv-p-composer__record').disabled).toBe(true)
  })

  it('reports the capture to the host from the request until the audio is sent', async () => {
    mountComposer()
    await press('.cv-p-composer__record')
    expect(captureEvents).toEqual([true])
    await act(async () => jest.advanceTimersByTime(1500))
    await press('.cv-p-recorder__stop')
    expect(captureEvents).toEqual([true])
    await press('.cv-p-recorder__send')
    expect(captureEvents).toEqual([true, false])
  })
})

describe('the whole thread: the audio leaves as its own message through the attachment path', () => {
  it('calls api.sendMessage once with one File and no text, even on two synchronous clicks', async () => {
    const sendMessage = mock(async () => ({ outcome: 'queued' as const }))
    const api = { fetchMessages: async () => [], sendMessage, resolveAttachmentUrl: async () => 'https://files.example/a' }
    container = harness.mount(
      <ConversationThread api={api} subject={{ subjectType: 'case', subjectId: '7' }} title="Case 7" audioRecording={{}} />,
    ).container
    await recordFor(1500)
    const sendButton = find('.cv-p-recorder__send')
    await act(async () => {
      sendButton.click()
      sendButton.click()
    })

    expect(sendMessage).toHaveBeenCalledTimes(1)
    const [request] = sendMessage.mock.calls[0] as unknown as [{ text?: string; files?: File[] }]
    expect(request.text).toBeUndefined()
    expect(request.files).toHaveLength(1)
  })
})
