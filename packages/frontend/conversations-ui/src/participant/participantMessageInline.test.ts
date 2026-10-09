import { describe, expect, it } from 'bun:test'

import { show } from './participantMessageFormat.test-helper'
import { parseInline } from './participantMessageInline'

function inline(line: string): string {
  return show(parseInline(line))
}

describe('parseInline - basic marks', () => {
  it('formats bold, italic, strike and inline code', () => {
    expect(inline('*a b*')).toBe('⟦s:a b⟧')
    expect(inline('x *a* y')).toBe('x ⟦s:a⟧ y')
    expect(inline('_a b_')).toBe('⟦e:a b⟧')
    expect(inline('~a b~')).toBe('⟦d:a b⟧')
    expect(inline('`a b`')).toBe('⟦c:a b⟧')
    expect(inline('oi *tudo* _bem_ ~mal~ `ok`')).toBe('oi ⟦s:tudo⟧ ⟦e:bem⟧ ⟦d:mal⟧ ⟦c:ok⟧')
  })

  it('formats marks that touch punctuation', () => {
    expect(inline('(*a*)')).toBe('(⟦s:a⟧)')
    expect(inline('*a*, _b_.')).toBe('⟦s:a⟧, ⟦e:b⟧.')
  })

  it('treats triple backticks in the middle of a line as inline code', () => {
    expect(inline('veja ```x y``` aqui')).toBe('veja ⟦c:x y⟧ aqui')
  })
})

describe('parseInline - nesting', () => {
  it('nests valid combinations in both orders', () => {
    expect(inline('*_negrito itálico_*')).toBe('⟦s:⟦e:negrito itálico⟧⟧')
    expect(inline('_*assim*_')).toBe('⟦e:⟦s:assim⟧⟧')
    expect(inline('~*_x_*~')).toBe('⟦d:⟦s:⟦e:x⟧⟧⟧')
    expect(inline('*a _b_ c*')).toBe('⟦s:a ⟦e:b⟧ c⟧')
  })

  it('does not let crossing marks form invalid trees', () => {
    expect(inline('*a _b* c_')).toBe('⟦s:a _b⟧ c_')
    expect(inline('_a *b_ c*')).toBe('⟦e:a *b⟧ c*')
  })

  it('keeps code inside marks and never formats inside code', () => {
    expect(inline('*a `b` c*')).toBe('⟦s:a ⟦c:b⟧ c⟧')
    expect(inline('`*a*`')).toBe('⟦c:*a*⟧')
    expect(inline('`_a_ ~b~`')).toBe('⟦c:_a_ ~b~⟧')
  })
})

describe('parseInline - loose markers', () => {
  it('does not format when the marker is glued to whitespace', () => {
    expect(inline('* a *')).toBe('* a *')
    expect(inline('2 * 3 * 4')).toBe('2 * 3 * 4')
    expect(inline('_ a _')).toBe('_ a _')
    expect(inline('~ a ~')).toBe('~ a ~')
  })

  it('does not format inside a word', () => {
    expect(inline('snake_case_nome')).toBe('snake_case_nome')
    expect(inline('a*b*c')).toBe('a*b*c')
    expect(inline('2*3*4')).toBe('2*3*4')
  })

  it('leaves unmatched and empty markers alone', () => {
    expect(inline('*a')).toBe('*a')
    expect(inline('a*')).toBe('a*')
    expect(inline('**')).toBe('**')
    expect(inline('__')).toBe('__')
    expect(inline('``')).toBe('``')
    expect(inline('`aberto')).toBe('`aberto')
  })
})

describe('parseInline - emoji', () => {
  it('keeps ZWJ sequences, flags, skin tones and variation selectors intact', () => {
    expect(inline('*👨‍👩‍👧*')).toBe('⟦s:👨‍👩‍👧⟧')
    expect(inline('🇧🇷 _oi_')).toBe('🇧🇷 ⟦e:oi⟧')
    expect(inline('👍🏽*x*')).toBe('👍🏽⟦s:x⟧')
    expect(inline('‼️ ~não~')).toBe('‼️ ⟦d:não⟧')
    expect(inline('👨‍👩‍👧 🇧🇷 👍🏽 ‼️')).toBe('👨‍👩‍👧 🇧🇷 👍🏽 ‼️')
  })
})
