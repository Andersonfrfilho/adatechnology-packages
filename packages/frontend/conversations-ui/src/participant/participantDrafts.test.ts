import { describe, expect, it } from 'bun:test'

import { clearDraft, clearDraftIfUnchanged, draftKey, EMPTY_PARTICIPANT_DRAFT, getDraft, setDraft } from './participantDrafts'

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

  it('a failed send keeps the draft because only a confirmed send clears it', () => {
    const sent = { text: 'hello', files: [] }
    const drafts = setDraft(new Map(), TRIP_A, sent)

    expect(getDraft(drafts, TRIP_A)).toBe(sent)
    expect(getDraft(clearDraftIfUnchanged(drafts, TRIP_A, sent), TRIP_A).text).toBe('')
  })

  it('keeps text typed while the send was in flight', () => {
    const sent = { text: 'hello', files: [] }
    const typedAfter = { text: 'hello and more', files: [] }
    const drafts = setDraft(new Map(), TRIP_A, typedAfter)

    expect(getDraft(clearDraftIfUnchanged(drafts, TRIP_A, sent), TRIP_A)).toBe(typedAfter)
  })
})
