import { describe, expect, it } from 'bun:test'

import type { ParticipantConversationSummary } from '@adatechnology/conversation-contracts'

import { groupParticipantConversations } from './participantGrouping'

function build(
  overrides: Partial<ParticipantConversationSummary> & { subjectId: string },
): ParticipantConversationSummary {
  return {
    subjectType: 'invoice',
    subjectLabel: 'Label',
    lastMessageAt: '2026-10-01T10:00:00.000Z',
    unreadCount: 0,
    awaitingParticipant: false,
    status: 'open',
    ...overrides,
  }
}

const GROUPS = [
  { subjectType: 'zeta', label: 'Zeta' },
  { subjectType: 'alpha', label: 'Alpha' },
] as const

function keysOf(view: ReturnType<typeof groupParticipantConversations>): string[] {
  return view.sections.map((section) => section.key)
}

describe('groupParticipantConversations', () => {
  it('applies precedence closed > awaiting > group > other', () => {
    const view = groupParticipantConversations({
      subjectGroups: GROUPS,
      conversations: [
        build({ subjectId: '1', subjectType: 'zeta', status: 'closed', awaitingParticipant: true }),
        build({ subjectId: '2', subjectType: 'zeta', awaitingParticipant: true }),
        build({ subjectId: '3', subjectType: 'zeta' }),
        build({ subjectId: '4', subjectType: 'unknown' }),
      ],
    })
    expect(keysOf(view)).toEqual(['awaiting', 'zeta', 'other', 'closed'])
    expect(view.sections.map((section) => section.conversations.map((c) => c.subjectId))).toEqual([
      ['2'],
      ['3'],
      ['4'],
      ['1'],
    ])
  })

  it('orders group sections by the subjectGroups array, not alphabetically, skipping empty groups', () => {
    const view = groupParticipantConversations({
      subjectGroups: [...GROUPS, { subjectType: 'empty', label: 'Empty' }],
      conversations: [build({ subjectId: '1', subjectType: 'alpha' }), build({ subjectId: '2', subjectType: 'zeta' })],
    })
    expect(keysOf(view)).toEqual(['zeta', 'alpha'])
  })

  it('sorts by lastMessageAt descending, null last, ties by subjectLabel', () => {
    const view = groupParticipantConversations({
      subjectGroups: GROUPS,
      conversations: [
        build({ subjectId: 'a', subjectType: 'zeta', lastMessageAt: null, subjectLabel: 'A' }),
        build({ subjectId: 'b', subjectType: 'zeta', lastMessageAt: '2026-10-01T10:00:00.000Z', subjectLabel: 'Beta' }),
        build({ subjectId: 'c', subjectType: 'zeta', lastMessageAt: '2026-10-02T10:00:00.000Z', subjectLabel: 'Z' }),
        build({
          subjectId: 'd',
          subjectType: 'zeta',
          lastMessageAt: '2026-10-01T10:00:00.000Z',
          subjectLabel: 'Alpha',
        }),
      ],
    })
    expect(view.sections[0]?.conversations.map((c) => c.subjectId)).toEqual(['c', 'd', 'b', 'a'])
  })

  it('sums unread per section and per filter', () => {
    const view = groupParticipantConversations({
      subjectGroups: GROUPS,
      conversations: [
        build({ subjectId: '1', subjectType: 'zeta', unreadCount: 2 }),
        build({ subjectId: '2', subjectType: 'zeta', unreadCount: 3, awaitingParticipant: true }),
        build({ subjectId: '3', subjectType: 'alpha', unreadCount: 4 }),
      ],
    })
    expect(view.sections.map((section) => [section.key, section.unreadCount])).toEqual([
      ['awaiting', 3],
      ['zeta', 2],
      ['alpha', 4],
    ])
    expect(view.filters.map((filter) => [filter.subjectType, filter.unreadCount])).toEqual([
      ['all', 9],
      ['zeta', 5],
      ['alpha', 4],
    ])
  })

  it('places every conversation in exactly one section', () => {
    const conversations = [
      build({ subjectId: '1', subjectType: 'zeta', status: 'closed' }),
      build({ subjectId: '2', subjectType: 'alpha', awaitingParticipant: true }),
      build({ subjectId: '3', subjectType: 'nope' }),
      build({ subjectId: '4', subjectType: 'alpha' }),
      build({ subjectId: '5', subjectType: 'zeta', lastMessageAt: null }),
    ]
    const view = groupParticipantConversations({ subjectGroups: GROUPS, conversations })
    const total = view.sections.reduce((sum, section) => sum + section.conversations.length, 0)
    expect(total).toBe(conversations.length)
  })

  it('sends unknown subjectType to other and never drops it', () => {
    const view = groupParticipantConversations({
      subjectGroups: GROUPS,
      conversations: [build({ subjectId: '1', subjectType: 'mystery' })],
    })
    expect(keysOf(view)).toEqual(['other'])
  })

  it('shows filters only with two or more groups that have conversations', () => {
    const one = groupParticipantConversations({
      subjectGroups: GROUPS,
      conversations: [build({ subjectId: '1', subjectType: 'zeta' })],
    })
    expect(one.showFilters).toBe(false)
    const two = groupParticipantConversations({
      subjectGroups: GROUPS,
      conversations: [build({ subjectId: '1', subjectType: 'zeta' }), build({ subjectId: '2', subjectType: 'alpha' })],
    })
    expect(two.showFilters).toBe(true)
  })

  it('restricts every section to the filtered subjectType, including awaiting', () => {
    const view = groupParticipantConversations({
      subjectGroups: GROUPS,
      filter: 'alpha',
      conversations: [
        build({ subjectId: '1', subjectType: 'zeta', awaitingParticipant: true }),
        build({ subjectId: '2', subjectType: 'alpha', awaitingParticipant: true }),
        build({ subjectId: '3', subjectType: 'alpha' }),
        build({ subjectId: '4', subjectType: 'zeta' }),
      ],
    })
    expect(view.sections.map((section) => section.conversations.map((c) => c.subjectId))).toEqual([['2'], ['3']])
    expect(
      groupParticipantConversations({
        subjectGroups: GROUPS,
        filter: 'all',
        conversations: [build({ subjectId: '1' })],
      }).sections,
    ).toHaveLength(1)
  })
})

describe('groupParticipantConversations with a search query', () => {
  const conversations = [
    build({ subjectId: '1', subjectType: 'alpha', protocol: '261009-K7M2', unreadCount: 2 }),
    build({ subjectId: '2', subjectType: 'zeta', protocol: '261008-AB23', unreadCount: 1 }),
    build({ subjectId: '3', subjectType: 'zeta', protocol: '261007-CD45' }),
  ]
  const idsOf = (view: ReturnType<typeof groupParticipantConversations>) =>
    view.sections.flatMap((section) => section.conversations.map((item) => item.subjectId))

  it('keeps chips and counts computed on the whole list, not on the search result', () => {
    const view = groupParticipantConversations({
      conversations,
      subjectGroups: GROUPS,
      filter: 'all',
      searchQuery: 'k7m2',
    })
    expect(idsOf(view)).toEqual(['1'])
    expect(view.showFilters).toBe(true)
    expect(view.filters.map((filter) => [filter.subjectType, filter.unreadCount])).toEqual([
      ['all', 3],
      ['zeta', 1],
      ['alpha', 2],
    ])
  })

  it('chip of another subject plus the protocol of a conversation outside it: chips stay and the view says so', () => {
    const view = groupParticipantConversations({
      conversations,
      subjectGroups: GROUPS,
      filter: 'zeta',
      searchQuery: '261009',
    })
    expect(view.sections).toEqual([])
    expect(view.showFilters).toBe(true)
    expect(view.hasMatchesOutsideFilter).toBe(true)
  })

  it('a query that matches inside the active filter shows only those rows', () => {
    const view = groupParticipantConversations({
      conversations,
      subjectGroups: GROUPS,
      filter: 'zeta',
      searchQuery: 'ab23',
    })
    expect(idsOf(view)).toEqual(['2'])
    expect(view.hasMatchesOutsideFilter).toBe(false)
  })

  it('a query that matches nothing anywhere is not an outside-filter match', () => {
    const view = groupParticipantConversations({
      conversations,
      subjectGroups: GROUPS,
      filter: 'zeta',
      searchQuery: 'zzz',
    })
    expect(view.hasMatchesOutsideFilter).toBe(false)
    expect(view.showFilters).toBe(true)
  })

  it('without a query nothing is outside the filter', () => {
    const view = groupParticipantConversations({ conversations, subjectGroups: GROUPS, filter: 'zeta' })
    expect(view.hasMatchesOutsideFilter).toBe(false)
  })

  it('a filter pointing at a subject with no conversations behaves as all', () => {
    const view = groupParticipantConversations({
      conversations: [build({ subjectId: '1', subjectType: 'zeta' })],
      subjectGroups: GROUPS,
      filter: 'alpha',
    })
    expect(idsOf(view)).toEqual(['1'])
    expect(view.activeFilter).toBe('all')
    expect(view.hasMatchesOutsideFilter).toBe(false)
  })

  it('keeps a filter that still has conversations as active', () => {
    const view = groupParticipantConversations({
      conversations: [build({ subjectId: '1', subjectType: 'zeta' })],
      subjectGroups: GROUPS,
      filter: 'zeta',
    })
    expect(view.activeFilter).toBe('zeta')
  })
})
