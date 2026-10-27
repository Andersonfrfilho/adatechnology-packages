import { describe, expect, it } from 'bun:test'

import { fitTextareaHeight, type AutoGrowTarget } from './participantAutoGrow'

describe('fitTextareaHeight', () => {
  it('measures after resetting, so the field can also shrink', () => {
    const heights: string[] = []
    const target: AutoGrowTarget = {
      style: {
        get height() {
          return heights.at(-1) ?? ''
        },
        set height(value: string) {
          heights.push(value)
        },
      },
      scrollHeight: 96,
      offsetHeight: 96,
      clientHeight: 96,
    }
    fitTextareaHeight(target)
    expect(heights).toEqual(['auto', '96px'])
  })

  it('adds the border to the content height, so a border-box field does not overflow', () => {
    const heights: string[] = []
    const target: AutoGrowTarget = {
      style: {
        get height() {
          return heights.at(-1) ?? ''
        },
        set height(value: string) {
          heights.push(value)
        },
      },
      scrollHeight: 61,
      offsetHeight: 63,
      clientHeight: 61,
    }
    fitTextareaHeight(target)
    expect(heights.at(-1)).toBe('63px')
  })
})
