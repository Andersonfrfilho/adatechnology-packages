import { describe, expect, it } from 'bun:test'

import { shouldMarkParticipantRead } from './shouldMarkRead'

const SUBJECT = { subjectType: 'trip', subjectId: 'a' }

describe('shouldMarkParticipantRead', () => {
  it('is true for the selected subject, visible, with unread messages', () => {
    expect(shouldMarkParticipantRead({ selected: SUBJECT, subject: { ...SUBJECT }, visibilityState: 'visible', unreadCount: 2 })).toBe(true)
  })
  it('is false when nothing is selected', () => {
    expect(shouldMarkParticipantRead({ selected: undefined, subject: SUBJECT, visibilityState: 'visible', unreadCount: 2 })).toBe(false)
  })
  it('is false when another subject is selected (id or type differs)', () => {
    expect(shouldMarkParticipantRead({ selected: { subjectType: 'trip', subjectId: 'b' }, subject: SUBJECT, visibilityState: 'visible', unreadCount: 2 })).toBe(false)
    expect(shouldMarkParticipantRead({ selected: { subjectType: 'invoice', subjectId: 'a' }, subject: SUBJECT, visibilityState: 'visible', unreadCount: 2 })).toBe(false)
  })
  it('is false while the document is hidden', () => {
    expect(shouldMarkParticipantRead({ selected: SUBJECT, subject: SUBJECT, visibilityState: 'hidden', unreadCount: 2 })).toBe(false)
  })
  it('is false without unread messages', () => {
    expect(shouldMarkParticipantRead({ selected: SUBJECT, subject: SUBJECT, visibilityState: 'visible', unreadCount: 0 })).toBe(false)
  })
})
