import { describe, expect, it } from 'bun:test'

import type { ParticipantMessageActionsTarget } from './ParticipantAuthorAvatar'
import { copyableText, formatMessagesForCopy, selectedInOrder, toggleSelectedId } from './participantMessageMenuModel'

const FIRST: ParticipantMessageActionsTarget = {
  id: 'm1',
  text: 'Wait at the dock.',
  authorName: 'Ana',
  isMine: true,
  attachments: [],
  createdAt: '2026-10-20T14:20:00',
}
const SECOND: ParticipantMessageActionsTarget = {
  id: 'm2',
  text: '  Here is the bill.  ',
  authorName: 'Bruno',
  isMine: false,
  attachments: [{ id: 'a1', kind: 'document', filename: 'bill.pdf', mimeType: 'application/pdf', sizeBytes: 10 }],
  createdAt: '2026-10-20T14:41:00',
}

describe('message menu model', () => {
  it('toggles an id in and out, keeping the pick order', () => {
    expect(toggleSelectedId(['m2'], 'm1')).toEqual(['m2', 'm1'])
    expect(toggleSelectedId(['m2', 'm1'], 'm2')).toEqual(['m1'])
  })

  it('returns the selection in conversation order, not pick order', () => {
    expect(selectedInOrder([FIRST, SECOND], ['m2', 'm1']).map((message) => message.id)).toEqual(['m1', 'm2'])
  })

  it('copies one message as its trimmed text, and nothing for a file alone', () => {
    expect(copyableText(SECOND)).toBe('Here is the bill.')
    expect(copyableText({ text: '   ' })).toBeNull()
  })

  it('copies several messages with date, time and author, one line each, files by name', () => {
    expect(formatMessagesForCopy([FIRST, SECOND], { locale: 'pt-BR', meLabel: 'Eu' })).toBe(
      '[20/10/2026 14:20] Eu: Wait at the dock.\n[20/10/2026 14:41] Bruno: Here is the bill. [bill.pdf]',
    )
  })
})
