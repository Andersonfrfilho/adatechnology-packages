import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

const CSS = readFileSync(join(import.meta.dir, 'styles.css'), 'utf8')

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(CSS)
  if (!match) throw new Error(`regra ${selector} não encontrada`)
  return match[1] ?? ''
}

describe.each(['.cv-workspace-chip', '.cv-workspace-toggle'])('%s', (selector) => {
  it('troca de cor com transição de 150 ms ease-out, sem animar layout', () => {
    const body = ruleBody(selector)
    expect(body).toMatch(/transition:[^;]*background-color 150ms ease-out/)
    expect(body).toMatch(/transition:[^;]*color 150ms ease-out/)
    expect(body).not.toMatch(/transition:[^;]*\ball\b/)
  })
})

describe('chips de filtro do workspace', () => {
  it('têm foco visível próprio', () => {
    expect(CSS).toMatch(/\.cv-workspace-chip:focus-visible[^{]*\{[^}]*outline: 2px solid/)
    expect(CSS).toContain('.cv-workspace-toggle:focus-visible')
  })

  it('zeram a transição com prefers-reduced-motion: reduce', () => {
    expect(CSS).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.cv-workspace-chip, \.cv-workspace-toggle \{ transition: none; \}/,
    )
  })
})
