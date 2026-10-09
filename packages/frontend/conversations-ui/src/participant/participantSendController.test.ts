import { describe, expect, it } from 'bun:test'

import type { ParticipantMessage } from '@adatechnology/conversation-contracts'

import {
  appendEntryToDraft,
  collectKnownClientMessageIds,
  createParticipantSendEntry,
  findFailedEntry,
  hasSendingEntry,
  participantSendReducer,
  toLocalPending,
  type ParticipantSendEntry,
} from './participantSendController'
import { participantSendStatesReducer, selectSendEntries } from './participantSendStates'
import { takeDraftForSend, setDraft } from './participantDrafts'

const TRIP_A = { subjectType: 'trip', subjectId: 'a' }
const TRIP_B = { subjectType: 'trip', subjectId: 'b' }

function entry(clientMessageId: string, overrides: Partial<ParticipantSendEntry> = {}): ParticipantSendEntry {
  return createParticipantSendEntry({
    clientMessageId,
    subject: TRIP_A,
    content: { text: 'hello', files: [] },
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  })
}

function serverMessage(id: string, clientMessageId?: string): ParticipantMessage {
  return { id, direction: 'inbound', attachments: [], createdAt: '2026-10-01T10:00:00.000Z', ...(clientMessageId ? { clientMessageId } : {}) }
}

function states(entries: readonly ParticipantSendEntry[]) {
  return entries.map((item) => [item.clientMessageId, item.state])
}

describe('participantSendReducer', () => {
  it('starting a send registers a sending entry holding text and files', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const started = participantSendReducer([], {
      type: 'started',
      entry: entry('c1', { files: [file] }),
    })

    expect(states(started)).toEqual([['c1', 'sending']])
    expect(started[0]?.files).toEqual([file])
    expect(started[0]?.text).toBe('hello')
  })

  it('a confirmed send disappears (the server message takes its place)', () => {
    const sending = participantSendReducer([], { type: 'started', entry: entry('c1') })
    expect(participantSendReducer(sending, { type: 'confirmed', clientMessageId: 'c1' })).toEqual([])
  })

  it('queued stays visible as queued until the host or the server reflect the id', () => {
    const sending = participantSendReducer([], { type: 'started', entry: entry('c1') })
    const queued = participantSendReducer(sending, { type: 'queued', clientMessageId: 'c1' })

    expect(states(queued)).toEqual([['c1', 'queued']])
    expect(states(participantSendReducer(queued, { type: 'reflected', knownClientMessageIds: new Set() }))).toEqual([['c1', 'queued']])
    expect(participantSendReducer(queued, { type: 'reflected', knownClientMessageIds: new Set(['c1']) })).toEqual([])
  })

  it('reflecting an unknown id returns the same reference (no rerender)', () => {
    const queued = participantSendReducer([], { type: 'started', entry: entry('c1') })
    expect(participantSendReducer(queued, { type: 'reflected', knownClientMessageIds: new Set(['other']) })).toBe(queued)
  })

  it('a throw marks failed keeping text and files; retry reuses the same id and goes back to sending', () => {
    const file = new File(['x'], 'a.png')
    const failed = participantSendReducer(participantSendReducer([], { type: 'started', entry: entry('c1', { files: [file] }) }), {
      type: 'failed',
      clientMessageId: 'c1',
    })

    expect(findFailedEntry(failed, 'c1')?.files).toEqual([file])
    const retried = participantSendReducer(failed, { type: 'retried', clientMessageId: 'c1' })
    expect(states(retried)).toEqual([['c1', 'sending']])
    expect(retried[0]?.text).toBe('hello')
  })

  it('retry only applies to failed entries', () => {
    const sending = participantSendReducer([], { type: 'started', entry: entry('c1') })
    expect(participantSendReducer(sending, { type: 'retried', clientMessageId: 'c1' })).toBe(sending)
    expect(findFailedEntry(sending, 'c1')).toBeUndefined()
  })

  it('discard removes the pending', () => {
    const failed = participantSendReducer(participantSendReducer([], { type: 'started', entry: entry('c1') }), { type: 'failed', clientMessageId: 'c1' })
    expect(participantSendReducer(failed, { type: 'discarded', clientMessageId: 'c1' })).toEqual([])
  })

  it('edit returns text and files to the draft, with the current field content kept after them', () => {
    const file = new File(['x'], 'a.png')
    const other = new File(['y'], 'b.png')
    const failed = entry('c1', { files: [file], state: 'failed' })

    expect(appendEntryToDraft(failed, { text: '', files: [] })).toEqual({ text: 'hello', files: [file] })
    expect(appendEntryToDraft(failed, { text: 'typed', files: [other] })).toEqual({ text: 'hello\ntyped', files: [file, other] })
  })

  it('maps entries to local pending messages without the files', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const [pending] = toLocalPending([entry('c1', { files: [file], state: 'queued' })])

    expect(pending).toMatchObject({ clientMessageId: 'c1', state: 'queued', text: 'hello' })
    expect(pending?.attachments).toEqual([{ filename: 'a.png', mimeType: 'image/png', sizeBytes: 1 }])
    expect(pending).not.toHaveProperty('files')
  })

  it('collects the ids known by the server and by the host queue', () => {
    const known = collectKnownClientMessageIds({
      messages: [serverMessage('m1', 'c1'), serverMessage('m2')],
      hostPending: [{ clientMessageId: 'c2', subject: TRIP_A, createdAt: '2026-10-01T10:00:00.000Z', state: 'queued' }],
    })
    expect([...known].sort()).toEqual(['c1', 'c2'])
  })
})

describe('send flow with the double tap', () => {
  it('the second tap finds the field already empty and sends nothing', () => {
    const drafts = setDraft(new Map(), TRIP_A, { text: '  hello  ', files: [] })

    const first = takeDraftForSend(drafts, TRIP_A)
    const second = takeDraftForSend(first.drafts, TRIP_A)

    expect(first.content).toEqual({ text: 'hello' })
    expect(second.content).toBeUndefined()
  })

  it('an empty or whitespace-only field sends nothing and keeps the drafts reference', () => {
    const drafts = setDraft(new Map(), TRIP_A, { text: '   ', files: [] })
    const taken = takeDraftForSend(drafts, TRIP_A)

    expect(taken.content).toBeUndefined()
    expect(taken.drafts).toBe(drafts)
  })

  it('failure then edit hands the content back to the draft and leaves a single owner', () => {
    const drafts = setDraft(new Map(), TRIP_A, { text: 'hello', files: [] })
    const { drafts: cleared, content } = takeDraftForSend(drafts, TRIP_A)
    const started = participantSendReducer([], {
      type: 'started',
      entry: createParticipantSendEntry({ clientMessageId: 'c1', subject: TRIP_A, content: content ?? { files: [] }, createdAt: '2026-10-01T10:00:00.000Z' }),
    })
    const failed = participantSendReducer(started, { type: 'failed', clientMessageId: 'c1' })
    const failedEntry = findFailedEntry(failed, 'c1')

    expect(cleared.get('trip:a')).toBeUndefined()
    expect(failedEntry && appendEntryToDraft(failedEntry, { text: '', files: [] })).toEqual({ text: 'hello', files: [] })
    expect(participantSendReducer(failed, { type: 'discarded', clientMessageId: 'c1' })).toEqual([])
  })
})

describe('participantSendStatesReducer', () => {
  it('keeps the entries per subject so leaving and coming back does not lose a failed message', () => {
    const afterA = participantSendStatesReducer(new Map(), { subject: TRIP_A, action: { type: 'started', entry: entry('c1') } })
    const afterFailed = participantSendStatesReducer(afterA, { subject: TRIP_A, action: { type: 'failed', clientMessageId: 'c1' } })

    expect(states(selectSendEntries(afterFailed, TRIP_A))).toEqual([['c1', 'failed']])
    expect(selectSendEntries(afterFailed, TRIP_B)).toEqual([])
  })

  it('drops the subject key when its last entry goes away and ignores no-ops by reference', () => {
    const started = participantSendStatesReducer(new Map(), { subject: TRIP_A, action: { type: 'started', entry: entry('c1') } })
    const noop = participantSendStatesReducer(started, { subject: TRIP_A, action: { type: 'reflected', knownClientMessageIds: new Set() } })
    const gone = participantSendStatesReducer(started, { subject: TRIP_A, action: { type: 'discarded', clientMessageId: 'c1' } })

    expect(noop).toBe(started)
    expect(gone.size).toBe(0)
  })
})

describe('hasSendingEntry', () => {
  it('is true only while some send is in the sending state', () => {
    expect(hasSendingEntry([])).toBe(false)
    expect(hasSendingEntry([entry('a', { state: 'failed' }), entry('b', { state: 'queued' })])).toBe(false)
    expect(hasSendingEntry([entry('a', { state: 'failed' }), entry('b', { state: 'sending' })])).toBe(true)
  })
})
