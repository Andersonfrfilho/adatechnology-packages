import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

import { splitBlocks } from './cssBlocks.test-helper'

const CSS = readFileSync(join(import.meta.dir, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

const NON_SHRINKING_ITEMS = [
  '.cv-p-filters',
  '.cv-p-quick',
  '.cv-p-search',
  '.cv-p-composer',
  '.cv-p-thread__header',
  '.cv-p-thread__subject-card',
]

type FlexState = { grow: number; shrink: number }

const FLEX_KEYWORDS: Record<string, FlexState> = {
  none: { grow: 0, shrink: 0 },
  auto: { grow: 1, shrink: 1 },
  initial: { grow: 0, shrink: 1 },
}

function parseFlexShorthand(value: string): FlexState {
  const keyword = FLEX_KEYWORDS[value]
  if (keyword) return { ...keyword }
  const numbers = value
    .split(/\s+/)
    .filter((token) => /^\d*\.?\d+$/.test(token))
    .map(Number)
  return { grow: numbers[0] ?? 0, shrink: numbers[1] ?? 1 }
}

function cleanValue(raw: string): string {
  return raw
    .replace(/!important/g, '')
    .trim()
    .toLowerCase()
}

// Only depth-0 style rules count (@media/@supports are conditional); later declarations win.
function effectiveFlex(selector: string): FlexState | undefined {
  let state: FlexState | undefined
  for (const { prelude, body } of splitBlocks(CSS)) {
    if (body === undefined || prelude.startsWith('@')) continue
    if (!prelude.split(',').some((entry) => entry.trim() === selector)) continue
    for (const declaration of body.split(';')) {
      const separator = declaration.indexOf(':')
      if (separator === -1) continue
      const property = declaration.slice(0, separator).trim().toLowerCase()
      const value = cleanValue(declaration.slice(separator + 1))
      if (property === 'flex') state = parseFlexShorthand(value)
      if (property === 'flex-shrink') state = { grow: state?.grow ?? 0, shrink: Number(value) }
    }
  }
  return state
}

function hasMinHeightZero(selector: string): boolean {
  return splitBlocks(CSS).some(
    ({ prelude, body }) =>
      body !== undefined &&
      !prelude.startsWith('@') &&
      prelude.split(',').some((entry) => entry.trim() === selector) &&
      /min-height:\s*0\b/.test(body),
  )
}

describe('participant view flex layout', () => {
  it.each(NON_SHRINKING_ITEMS)('%s does not shrink inside a flex column', (selector) => {
    expect(effectiveFlex(selector)?.shrink).toBe(0)
  })

  it('keeps the thread scroller as the only shrinking, growing region', () => {
    const scroller = effectiveFlex('.cv-p-thread__scroll')
    expect(scroller?.grow).toBe(1)
    expect(scroller?.shrink).toBe(1)
    expect(hasMinHeightZero('.cv-p-thread__scroll')).toBe(true)
  })
})
