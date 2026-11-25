import { describe, expect, it } from 'bun:test'

import type { FlowGlobalKeyword } from './flowRunner.types'
import { matchGlobalKeyword } from './matchGlobalKeyword'

describe('matchGlobalKeyword', () => {
  it('keeps exact as the default: only the whole message matches', () => {
    const entries: FlowGlobalKeyword[] = [{ keywords: ['menu'], target: 'restart' }]
    expect(matchGlobalKeyword('MENÚ', entries)).toBe('restart')
    expect(matchGlobalKeyword('quero o menu', entries)).toBeUndefined()
  })

  it('matches a whole word inside the message, ignoring case and accents', () => {
    const entries: FlowGlobalKeyword[] = [{ keywords: ['atendente'], target: 'handoff', match: 'word' }]
    expect(matchGlobalKeyword('Quero falar com o ATENDENTE, por favor!', entries)).toBe('handoff')
  })

  it('does not match a fragment of a longer word', () => {
    const entries: FlowGlobalKeyword[] = [{ keywords: ['menu'], target: 'restart', match: 'word' }]
    expect(matchGlobalKeyword('submenus', entries)).toBeUndefined()
  })

  it('lets the longest keyword win across entries', () => {
    const entries: FlowGlobalKeyword[] = [
      { keywords: ['atendente'], target: 'handoff', match: 'word' },
      { keywords: ['menu do atendente'], target: 'restart', match: 'word' },
    ]
    expect(matchGlobalKeyword('abrir menu do atendente', entries)).toBe('restart')
  })

  it('mixes exact and word entries', () => {
    const entries: FlowGlobalKeyword[] = [
      { keywords: ['oi'], target: 'restart' },
      { keywords: ['atendente'], target: 'handoff', match: 'word' },
    ]
    expect(matchGlobalKeyword('oi', entries)).toBe('restart')
    expect(matchGlobalKeyword('oi atendente', entries)).toBe('handoff')
  })

  it('ignores empty messages', () => {
    expect(matchGlobalKeyword('  ', [{ keywords: ['a'], target: 'restart', match: 'word' }])).toBeUndefined()
  })
})
