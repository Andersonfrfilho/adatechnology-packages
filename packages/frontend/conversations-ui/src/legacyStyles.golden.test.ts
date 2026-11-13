import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

import { splitBlocks } from './cssBlocks.test-helper'

// legacyStyles.fixture.css is the styles.css shipped by 0.4.2; the stylesheet is global, so anything
// added since must be namespaced under .cv- and must not reach the host's own elements.
const LEGACY_CSS = readFileSync(join(import.meta.dir, 'legacyStyles.fixture.css'), 'utf8')
const CURRENT_CSS = readFileSync(join(import.meta.dir, 'styles.css'), 'utf8')

const NESTED_AT_RULES = ['@media', '@supports']
const ALLOWED_NEW_AT_RULES = ['@media', '@supports', '@keyframes']

type Inventory = { selectors: string[]; atRules: string[]; keyframeNames: string[] }

function splitSelectorList(prelude: string): string[] {
  const parts: string[] = []
  let parenthesisDepth = 0
  let current = ''
  for (const char of prelude) {
    if (char === '(') parenthesisDepth += 1
    if (char === ')') parenthesisDepth -= 1
    if (char === ',' && parenthesisDepth === 0) {
      parts.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  parts.push(current.trim())
  return parts.filter(Boolean)
}

function collect(css: string, inventory: Inventory): Inventory {
  for (const { prelude, body } of splitBlocks(css.replace(/\/\*[\s\S]*?\*\//g, ''))) {
    if (!prelude.startsWith('@')) {
      inventory.selectors.push(...splitSelectorList(prelude))
      continue
    }
    const atRuleName = prelude.split(/[\s(]/)[0] ?? prelude
    inventory.atRules.push(atRuleName)
    if (atRuleName === '@keyframes') inventory.keyframeNames.push(prelude.replace('@keyframes', '').trim())
    if (NESTED_AT_RULES.includes(atRuleName) && body !== undefined) collect(body, inventory)
  }
  return inventory
}

function inventoryOf(css: string): Inventory {
  return collect(css, { selectors: [], atRules: [], keyframeNames: [] })
}

function addedSince(legacy: readonly string[], current: readonly string[]): string[] {
  const remaining = [...legacy]
  return current.filter((entry) => {
    const position = remaining.indexOf(entry)
    if (position === -1) return true
    remaining.splice(position, 1)
    return false
  })
}

describe('styles.css não vaza para o host desde a 0.4.2', () => {
  const legacy = inventoryOf(LEGACY_CSS)
  const current = inventoryOf(CURRENT_CSS)
  const addedSelectors = addedSince(legacy.selectors, current.selectors)
  const addedAtRules = addedSince(legacy.atRules, current.atRules)

  it('G8: o parse enxerga as regras (guarda contra um parser que não acha nada)', () => {
    expect(legacy.selectors.length).toBeGreaterThan(100)
    expect(addedSelectors.length).toBeGreaterThan(20)
  })

  it('G8: todo seletor adicionado começa por .cv- ou .dark .cv-', () => {
    const offenders = addedSelectors.filter((selector) => !/^(\.dark )?\.cv-/.test(selector))

    expect(offenders).toEqual([])
  })

  it('G8: nenhum seletor global (:root, html, body, *) foi adicionado', () => {
    const globals = addedSelectors.filter((selector) => /^(:root|html|body|\*)([\s.:#[>+~,]|$)/.test(selector))

    expect(globals).toEqual([])
  })

  it('G8: nenhum @import, @layer ou outra at-rule nova além de @media, @supports e @keyframes', () => {
    expect(addedAtRules.filter((rule) => !ALLOWED_NEW_AT_RULES.includes(rule))).toEqual([])
    expect(addedSince(legacy.keyframeNames, current.keyframeNames).filter((name) => !name.startsWith('cv-'))).toEqual(
      [],
    )
  })
})
