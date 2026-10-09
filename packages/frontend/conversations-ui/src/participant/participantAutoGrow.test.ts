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
    }
    fitTextareaHeight(target)
    expect(heights).toEqual(['auto', '96px'])
  })
})
