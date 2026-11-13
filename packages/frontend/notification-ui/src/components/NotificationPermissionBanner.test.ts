/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { NotificationPermissionBanner } from './NotificationPermissionBanner'

const SOURCE = readFileSync(join(import.meta.dir, 'NotificationPermissionBanner.tsx'), 'utf8')

describe('NotificationPermissionBanner', () => {
  it('é uma função exportada válida', () => {
    expect(typeof NotificationPermissionBanner).toBe('function')
  })

  it('declara acessibilidade semântica (role region e alert)', () => {
    expect(SOURCE).toContain('role="region"')
    expect(SOURCE).toContain('role="alert"')
  })

  it('todos os botões possuem type="button"', () => {
    const buttons = SOURCE.match(/<button\b[^>]*>/g) ?? []
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      expect(button).toContain('type="button"')
    }
  })

  it('ícones decorativos contêm aria-hidden="true"', () => {
    const icons = SOURCE.match(/<(Bell|BellRing|BellOff|X)\b[^>]*>/g) ?? []
    expect(icons.length).toBeGreaterThan(0)
    for (const icon of icons) {
      expect(icon).toContain('aria-hidden="true"')
    }
  })

  it('botão só-ícone de fechar/dispensar declara aria-label', () => {
    expect(SOURCE).toContain("aria-label={messages['banner.dismiss']}")
  })

  it('não possui textos literais hardcoded em JSX', () => {
    const hardcodedText = SOURCE.match(/>\s*[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{3,}\s*</g) ?? []
    expect(hardcodedText).toEqual([])
  })
})
