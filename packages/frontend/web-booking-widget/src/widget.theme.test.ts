/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import { describe, expect, it } from 'bun:test'
import { applyThemeTokens, parseThemeTokens } from './widget.theme'

describe('parseThemeTokens', () => {
  it('returns an empty map for null input', () => {
    expect(parseThemeTokens(null)).toEqual({})
  })

  it('returns an empty map for malformed JSON', () => {
    expect(parseThemeTokens('{not json')).toEqual({})
  })

  it('returns an empty map for a JSON array or primitive', () => {
    expect(parseThemeTokens('[1,2,3]')).toEqual({})
    expect(parseThemeTokens('"just a string"')).toEqual({})
  })

  it('keeps only known token keys', () => {
    const tokens = parseThemeTokens(JSON.stringify({ primaryColor: '#0f766e', unknownKey: 'x' }))

    expect(tokens).toEqual({ primaryColor: '#0f766e' })
  })

  it('drops keys with non-string or blank values', () => {
    const tokens = parseThemeTokens(JSON.stringify({ primaryColor: 42, surfaceColor: '   ', radius: '8px' }))

    expect(tokens).toEqual({ radius: '8px' })
  })
})

describe('applyThemeTokens', () => {
  it('writes each recognized token as a CSS custom property on the element', () => {
    const properties = new Map<string, string>()
    const element = {
      style: { setProperty: (name: string, value: string) => properties.set(name, value) },
    } as unknown as HTMLElement

    applyThemeTokens(element, { primaryColor: '#0f766e', radius: '8px' })

    expect(properties.get('--ada-booking-primary')).toBe('#0f766e')
    expect(properties.get('--ada-booking-radius')).toBe('8px')
  })
})
