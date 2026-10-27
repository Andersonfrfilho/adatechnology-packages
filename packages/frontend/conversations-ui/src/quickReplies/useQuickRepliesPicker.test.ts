import { describe, expect, it } from 'bun:test'

import { nextHighlightedIndex } from './useQuickRepliesPicker'

describe('nextHighlightedIndex', () => {
  it('avança e roda para o começo no fim da lista (ArrowDown)', () => {
    expect(nextHighlightedIndex(0, 3, 1)).toBe(1)
    expect(nextHighlightedIndex(2, 3, 1)).toBe(0)
  })

  it('volta e roda para o fim no começo da lista (ArrowUp)', () => {
    expect(nextHighlightedIndex(1, 3, -1)).toBe(0)
    expect(nextHighlightedIndex(0, 3, -1)).toBe(2)
  })

  it('lista vazia sempre fica em zero', () => {
    expect(nextHighlightedIndex(0, 0, 1)).toBe(0)
    expect(nextHighlightedIndex(0, 0, -1)).toBe(0)
  })
})
