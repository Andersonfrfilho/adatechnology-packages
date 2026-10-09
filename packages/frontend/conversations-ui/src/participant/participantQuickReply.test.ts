import { describe, expect, it } from 'bun:test'

import { applyQuickReply } from './participantQuickReply'

describe('applyQuickReply', () => {
  it('fills an empty text with the reply', () => {
    expect(applyQuickReply('', 'On my way')).toBe('On my way')
    expect(applyQuickReply('   ', 'On my way')).toBe('On my way')
  })

  it('appends to existing text separated by a space', () => {
    expect(applyQuickReply('Hello', 'On my way')).toBe('Hello On my way')
  })

  it('does not double the separator when the text already ends in whitespace', () => {
    expect(applyQuickReply('Hello ', 'On my way')).toBe('Hello On my way')
    expect(applyQuickReply('Hello\n', 'On my way')).toBe('Hello\nOn my way')
  })

  it('returns the text untouched for an empty reply', () => {
    expect(applyQuickReply('Hello', '')).toBe('Hello')
  })
})
