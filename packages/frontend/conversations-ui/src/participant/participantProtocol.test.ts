import { describe, expect, it } from 'bun:test'

import { buildConversation } from './participantFixtures.test-helper'
import {
  PROTOCOL_SEARCH_CONVERSATION_THRESHOLD,
  filterConversationsBySearch,
  matchesProtocolQuery,
  normalizeProtocolQuery,
  shouldShowInboxSearch,
} from './participantProtocol'

describe('normalizeProtocolQuery', () => {
  it('uppercases and drops dashes and spaces', () => {
    expect(normalizeProtocolQuery(' 261009-k7 m2 ')).toBe('261009K7M2')
  })
})

describe('matchesProtocolQuery', () => {
  it('matches partially, without dash and without case', () => {
    expect(matchesProtocolQuery('261009-K7M2', '261009k7')).toBe(true)
    expect(matchesProtocolQuery('261009-K7M2', 'k7m2')).toBe(true)
    expect(matchesProtocolQuery('261009-K7M2', '9-k')).toBe(true)
  })

  it('does not match a different code', () => {
    expect(matchesProtocolQuery('261009-K7M2', 'ZZZ')).toBe(false)
  })

  it('an empty query matches everything, even a missing protocol', () => {
    expect(matchesProtocolQuery(undefined, '')).toBe(true)
    expect(matchesProtocolQuery('261009-K7M2', '  ')).toBe(true)
  })

  it('a missing protocol never matches a real query', () => {
    expect(matchesProtocolQuery(undefined, 'K7')).toBe(false)
  })
})

describe('filterConversationsBySearch', () => {
  const conversations = [
    buildConversation({ subjectId: '1', subjectLabel: 'Avaria na carga', protocol: '261009-K7M2' }),
    buildConversation({ subjectId: '2', subjectLabel: 'Entrega atrasada' }),
    buildConversation({ subjectId: '3', subjectLabel: 'Outro assunto', protocol: '261008-AB23' }),
  ]
  const ids = (query: string) => filterConversationsBySearch(conversations, query).map((item) => item.subjectId)

  it('returns everything for an empty query', () => {
    expect(ids('')).toEqual(['1', '2', '3'])
    expect(ids('   ')).toEqual(['1', '2', '3'])
  })

  it('matches the title without accent or case', () => {
    expect(ids('AVARIA')).toEqual(['1'])
    expect(ids('atrasáda')).toEqual(['2'])
  })

  it('matches the protocol partially, without dash and case', () => {
    expect(ids('k7m')).toEqual(['1'])
    expect(ids('261008')).toEqual(['3'])
    expect(ids('2610')).toEqual(['1', '3'])
  })

  it('a query of only separators does not match every protocol', () => {
    expect(ids('-')).toEqual([])
  })

  it('returns nothing when neither title nor protocol match', () => {
    expect(ids('zzz')).toEqual([])
  })
})

describe('shouldShowInboxSearch', () => {
  it('shows when some conversation has a protocol', () => {
    expect(shouldShowInboxSearch([buildConversation({ subjectId: '1', protocol: '261009-K7M2' })])).toBe(true)
  })

  it('shows beyond the threshold even without protocols', () => {
    const many = Array.from({ length: PROTOCOL_SEARCH_CONVERSATION_THRESHOLD + 1 }, (_, index) =>
      buildConversation({ subjectId: String(index) }),
    )
    expect(shouldShowInboxSearch(many)).toBe(true)
    expect(shouldShowInboxSearch(many.slice(0, PROTOCOL_SEARCH_CONVERSATION_THRESHOLD))).toBe(false)
  })

  it('hides for a short list without protocols', () => {
    expect(shouldShowInboxSearch([buildConversation({ subjectId: '1' })])).toBe(false)
  })
})
