import { describe, expect, it } from 'bun:test'

import {
  contrastRatio,
  declaredToken,
  defaultPalette,
  fallbackOf,
  flatten,
  mappedPalette,
  over,
  parseColor,
  tint,
  type Palette,
  type Rgba,
} from './participantContrast.test-helper'

const TEXT_MINIMUM = 4.5
const NON_TEXT_MINIMUM = 3
const WALLPAPER_SUBTLETY = 2

/** The light mapping a host panel can set on `.cv-p`; every other token keeps the package default. */
const PANEL_LIGHT_MAPPING = {
  surface: '#f2efe9',
  raised: '#ffffff',
  text: '#1f2a30',
  muted: '#59636a',
  border: '#cfc8bb',
  accent: '#a85a1c',
  highlight: '#fbf3ea',
} as const

type Scenario = { readonly name: string; readonly palette: Palette; readonly tick: Rgba; readonly tickRead: Rgba }

function scenario(name: string, palette: Palette, theme: 'light' | 'dark'): Scenario {
  const flat = flatten(palette)
  const tick = flat.muted
  const tickRead = parseColor(fallbackOf(declaredToken('--cv-p-i-tick-read', theme)))
  return { name, palette: flat, tick, tickRead }
}

const SCENARIOS: readonly Scenario[] = [
  scenario('light defaults', defaultPalette('light'), 'light'),
  scenario('dark defaults', defaultPalette('dark'), 'dark'),
  scenario('panel light mapping', mappedPalette(PANEL_LIGHT_MAPPING), 'light'),
]

function fillOf(palette: Palette, surface: 'received' | 'mine'): Rgba {
  return surface === 'received' ? palette.raised : over(palette.highlight, palette.surface)
}

describe.each(SCENARIOS.map((entry) => [entry.name, entry] as const))(
  'contrast: %s',
  (_name, { palette, tick, tickRead }) => {
    it('keeps the text of both bubbles at 4.5:1 or more', () => {
      for (const side of ['received', 'mine'] as const) {
        const fill = fillOf(palette, side)
        expect(contrastRatio(palette.text, fill)).toBeGreaterThanOrEqual(TEXT_MINIMUM)
        expect(contrastRatio(palette.muted, fill)).toBeGreaterThanOrEqual(TEXT_MINIMUM)
        expect(contrastRatio(palette.accent, fill)).toBeGreaterThanOrEqual(TEXT_MINIMUM)
        expect(contrastRatio(palette.danger, fill)).toBeGreaterThanOrEqual(TEXT_MINIMUM)
      }
    })

    it('keeps every tick at 3:1 or more on both bubbles', () => {
      for (const side of ['received', 'mine'] as const) {
        const fill = fillOf(palette, side)
        expect(contrastRatio(tick, fill)).toBeGreaterThanOrEqual(NON_TEXT_MINIMUM)
        expect(contrastRatio(tickRead, fill)).toBeGreaterThanOrEqual(NON_TEXT_MINIMUM)
        expect(contrastRatio(palette.danger, fill)).toBeGreaterThanOrEqual(NON_TEXT_MINIMUM)
      }
    })

    it('tells the own bubble from the page by an accent edge of 3:1 or more', () => {
      expect(contrastRatio(palette.accent, palette.surface)).toBeGreaterThanOrEqual(NON_TEXT_MINIMUM)
      expect(contrastRatio(palette.accent, fillOf(palette, 'mine'))).toBeGreaterThanOrEqual(NON_TEXT_MINIMUM)
    })

    it('reads copyable tokens: text at 4.5:1 on the tint, the dotted underline at 3:1', () => {
      for (const side of ['received', 'mine'] as const) {
        const tinted = tint(palette.accent, 14, fillOf(palette, side))
        expect(contrastRatio(palette.text, tinted)).toBeGreaterThanOrEqual(TEXT_MINIMUM)
        expect(contrastRatio(palette.accent, fillOf(palette, side))).toBeGreaterThanOrEqual(NON_TEXT_MINIMUM)
      }
    })

    it('lets text sit on the wallpaper dots and keeps the wallpaper itself subtle', () => {
      const ink = palette.border
      expect(contrastRatio(palette.text, ink)).toBeGreaterThanOrEqual(TEXT_MINIMUM)
      expect(contrastRatio(palette.danger, palette.surface)).toBeGreaterThanOrEqual(TEXT_MINIMUM)
      expect(contrastRatio(ink, palette.surface)).toBeLessThanOrEqual(WALLPAPER_SUBTLETY)
    })

    it('keeps the strip above the composer and the unread badge readable', () => {
      expect(contrastRatio(palette.accent, palette.raised)).toBeGreaterThanOrEqual(TEXT_MINIMUM)
      expect(contrastRatio(palette.accentContrast, palette.accent)).toBeGreaterThanOrEqual(TEXT_MINIMUM)
    })
  },
)
