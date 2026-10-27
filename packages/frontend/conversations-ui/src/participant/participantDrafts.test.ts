import { describe, expect, it } from 'bun:test'

import { clearDraft, takeDraftForSend, draftKey, EMPTY_PARTICIPANT_DRAFT, getDraft, setDraft } from './participantDrafts'

const TRIP_A = { subjectType: 'trip', subjectId: 'a' }
const TRIP_B = { subjectType: 'trip', subjectId: 'b' }
const INVOICE_A = { subjectType: 'invoice', subjectId: 'a' }

describe('participantDrafts', () => {
  it('builds the key from subject type and id', () => {
    expect(draftKey(TRIP_A)).toBe('trip:a')
    expect(draftKey(INVOICE_A)).not.toBe(draftKey(TRIP_A))
  })

  it('returns an empty draft for an unknown subject', () => {
    expect(getDraft(new Map(), TRIP_A)).toEqual({ text: '', files: [] })
    expect(getDraft(new Map(), TRIP_A)).toBe(EMPTY_PARTICIPANT_DRAFT)
  })

  it('does not leak a draft to another subject', () => {
    const drafts = setDraft(new Map(), TRIP_A, { text: 'hello', files: [] })

    expect(getDraft(drafts, TRIP_A).text).toBe('hello')
    expect(getDraft(drafts, TRIP_B).text).toBe('')
    expect(getDraft(drafts, INVOICE_A).text).toBe('')
  })

  it('is immutable and survives navigating away and back', () => {
    const original = new Map()
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const withDraft = setDraft(original, TRIP_A, { text: 'hello', files: [file] })
    const afterVisitingB = setDraft(withDraft, TRIP_B, { text: 'other', files: [] })

    expect(original.size).toBe(0)
    expect(withDraft).not.toBe(afterVisitingB)
    expect(getDraft(afterVisitingB, TRIP_A)).toEqual({ text: 'hello', files: [file] })
    expect(getDraft(withDraft, TRIP_B).text).toBe('')
  })

  it('clears only the sent subject', () => {
    const both = setDraft(setDraft(new Map(), TRIP_A, { text: 'a', files: [] }), TRIP_B, { text: 'b', files: [] })
    const cleared = clearDraft(both, TRIP_A)

    expect(getDraft(cleared, TRIP_A).text).toBe('')
    expect(getDraft(cleared, TRIP_B).text).toBe('b')
    expect(getDraft(both, TRIP_A).text).toBe('a')
  })

  it('taking the draft for a send clears the field at once and returns trimmed text and files', () => {
    const file = new File(['x'], 'a.png')
    const drafts = setDraft(new Map(), TRIP_A, { text: ' hello ', files: [file] })
    const taken = takeDraftForSend(drafts, TRIP_A)

    expect(taken.content).toEqual({ text: 'hello', files: [file] })
    expect(getDraft(taken.drafts, TRIP_A)).toEqual({ text: '', files: [] })
    expect(getDraft(drafts, TRIP_A).text).toBe(' hello ')
  })

  it('text typed after the tap belongs to the next send, never to the one in flight', () => {
    const first = takeDraftForSend(setDraft(new Map(), TRIP_A, { text: 'one', files: [] }), TRIP_A)
    const typed = setDraft(first.drafts, TRIP_A, { text: 'two', files: [] })

    expect(takeDraftForSend(typed, TRIP_A).content).toEqual({ text: 'two' })
  })
})
