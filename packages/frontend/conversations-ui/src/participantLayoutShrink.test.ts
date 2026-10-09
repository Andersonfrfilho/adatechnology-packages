import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

const CSS = readFileSync(join(import.meta.dir, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

const FIXED_HEIGHT_STRIPS = [
  '.cv-p-inbox__title',
  '.cv-p-search',
  '.cv-p-filters',
  '.cv-p-error',
  '.cv-p-loading',
  '.cv-p-inbox__more',
  '.cv-p-empty',
  '.cv-p-section__heading',
  '.cv-p-row',
  '.cv-p-thread__header',
  '.cv-p-thread__subject-card',
  '.cv-p-thread__live',
  '.cv-p-thread__closed',
  '.cv-p-composer',
  '.cv-p-quick',
  '.cv-p-files',
  '.cv-p-composer__row',
  '.cv-p-composer__error',
]

function declarationsFor(selector: string): string[] {
  const bodies: string[] = []
  for (const match of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (match[1] ?? '').split(',').map((entry) => entry.trim())
    if (selectors.includes(selector)) bodies.push(match[2] ?? '')
  }
  return bodies
}

function normalized(selector: string): string {
  return declarationsFor(selector).join(';').replace(/\s+/g, ' ')
}

describe('participant view flex layout', () => {
  it.each(FIXED_HEIGHT_STRIPS)('%s does not shrink inside a flex column', (selector) => {
    const css = normalized(selector)
    expect(css).not.toBe('')
    const hasShrinkZero = /flex-shrink:\s*0\b/.test(css) || /flex:\s*0 0 auto/.test(css)
    expect(hasShrinkZero).toBe(true)
  })

  it('keeps the thread scroller as the only shrinking, growing region', () => {
    const css = normalized('.cv-p-thread__scroll')
    expect(css).toMatch(/min-height:\s*0\b/)
    expect(css).toMatch(/flex:\s*1\b/)
    expect(css).not.toMatch(/flex-shrink:\s*0\b/)
    expect(css).not.toMatch(/flex:\s*0 0 auto/)
  })
})
