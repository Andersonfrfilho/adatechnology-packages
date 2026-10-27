import { describe, expect, it } from 'bun:test'

import type { ParticipantMessageActionsTarget } from './ParticipantAuthorAvatar'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS as LABELS } from './participantLabels'
import { conversationExportFileName, conversationExportText, messageInfoRows } from './participantMessageInfoModel'

function target(overrides: Partial<ParticipantMessageActionsTarget>): ParticipantMessageActionsTarget {
  return {
    id: 'm1',
    text: 'Hello',
    authorName: 'Bruno',
    isMine: false,
    attachments: [],
    createdAt: '2026-10-01T13:05:00.000Z',
    ...overrides,
  }
}

describe('message info', () => {
  it('lists author and send time of an incoming message, and nothing about delivery', () => {
    const rows = messageInfoRows(target({ status: 'read', readAt: '2026-10-01T14:00:00.000Z' }), LABELS, 'pt-BR')
    expect(rows.map((row) => row.id)).toEqual(['author', 'sent'])
    expect(rows[0]?.value).toBe('Bruno')
    expect(rows[1]?.value).toMatch(/^01\/10\/2026 \d{2}:05$/)
  })

  it('adds delivery state and read time to a message this side sent', () => {
    const rows = messageInfoRows(
      target({ isMine: true, status: 'read', readAt: '2026-10-01T14:10:00.000Z' }),
      LABELS,
      'pt-BR',
    )
    expect(rows.map((row) => [row.id, row.label])).toEqual([
      ['author', 'From'],
      ['sent', 'Sent'],
      ['status', 'Status'],
      ['read', 'Read'],
    ])
    expect(rows[0]?.value).toBe(LABELS.me)
    expect(rows[2]?.value).toBe(LABELS.statusRead)
    expect(rows[3]?.value).toMatch(/:10$/)
  })

  it('leaves out what the channel never reported', () => {
    expect(messageInfoRows(target({ isMine: true }), LABELS).map((row) => row.id)).toEqual(['author', 'sent'])
  })
})

describe('conversation export', () => {
  it('writes the title, a blank line and one stamped line per message', () => {
    const text = conversationExportText({
      title: 'Order 12',
      messages: [target({}), target({ id: 'm2', isMine: true, text: 'Ok' })],
      locale: 'pt-BR',
      meLabel: 'Me',
    })
    const lines = text.split('\n')
    expect(lines[0]).toBe('Order 12')
    expect(lines[1]).toBe('')
    expect(lines[2]).toMatch(/^\[01\/10\/2026 \d{2}:05\] Bruno: Hello$/)
    expect(lines[3]).toMatch(/\] Me: Ok$/)
  })

  it('makes a safe file name from the title', () => {
    expect(conversationExportFileName('NF 123/1: atraso')).toBe('NF 123 1 atraso.txt')
    expect(conversationExportFileName('  //  ')).toBe('conversation.txt')
  })
})
