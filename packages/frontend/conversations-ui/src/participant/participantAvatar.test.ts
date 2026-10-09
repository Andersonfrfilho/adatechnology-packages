import { describe, expect, it } from 'bun:test'

import { authorInitials, shouldShowAvatar } from './participantAvatar'

describe('authorInitials', () => {
  it('takes the first letters of the first and last names', () => {
    expect(authorInitials('Ana Souza')).toBe('AS')
    expect(authorInitials('maria ana souza lima')).toBe('ML')
  })

  it('uses a single initial for a single name', () => {
    expect(authorInitials('Ana')).toBe('A')
  })

  it('ignores prepositions and punctuation', () => {
    expect(authorInitials('Maria da Silva')).toBe('MS')
    expect(authorInitials('João de Souza e Silva')).toBe('JS')
    expect(authorInitials('  (Ana)   -  Souza. ')).toBe('AS')
  })

  it('keeps an accented initial and upper-cases it', () => {
    expect(authorInitials('élida ávila')).toBe('ÉÁ')
  })

  it('falls back to the first word when only prepositions remain', () => {
    expect(authorInitials('de da')).toBe('D')
  })

  it('returns undefined for missing, empty, question-mark or emoji-only names', () => {
    expect(authorInitials(null)).toBeUndefined()
    expect(authorInitials(undefined)).toBeUndefined()
    expect(authorInitials('')).toBeUndefined()
    expect(authorInitials('   ')).toBeUndefined()
    expect(authorInitials('?')).toBeUndefined()
    expect(authorInitials('😀')).toBeUndefined()
  })

  it('ignores a trailing emoji', () => {
    expect(authorInitials('Ana 😀')).toBe('A')
  })
})

describe('shouldShowAvatar', () => {
  it('shows it on the first message of a sequence', () => {
    expect(shouldShowAvatar({ previousAuthor: undefined, author: 'Ana', isMine: false })).toBe(true)
  })

  it('hides it while the same author keeps talking', () => {
    expect(shouldShowAvatar({ previousAuthor: 'Ana', author: 'Ana', isMine: false })).toBe(false)
  })

  it('shows it again when the author changes', () => {
    expect(shouldShowAvatar({ previousAuthor: 'Ana', author: 'Bruno', isMine: false })).toBe(true)
  })

  it('treats consecutive unnamed authors as one sequence', () => {
    expect(shouldShowAvatar({ previousAuthor: null, author: null, isMine: false })).toBe(false)
    expect(shouldShowAvatar({ previousAuthor: 'Ana', author: null, isMine: false })).toBe(true)
  })

  it('never shows it on an own message', () => {
    expect(shouldShowAvatar({ previousAuthor: undefined, author: null, isMine: true })).toBe(false)
    expect(shouldShowAvatar({ previousAuthor: 'Ana', author: 'Ana', isMine: true })).toBe(false)
  })
})
