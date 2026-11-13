import { declarationsIn } from './participantCss.test-helper'

export type Rgba = { readonly r: number; readonly g: number; readonly b: number; readonly a: number }

export type TokenName =
  'surface' | 'raised' | 'text' | 'muted' | 'border' | 'accent' | 'accentContrast' | 'highlight' | 'danger'

export type Palette = Readonly<Record<TokenName, Rgba>>

const TOKEN_VARIABLE: Record<TokenName, string> = {
  surface: '--cv-p-surface',
  raised: '--cv-p-surface-raised',
  text: '--cv-p-text',
  muted: '--cv-p-text-muted',
  border: '--cv-p-border',
  accent: '--cv-p-accent',
  accentContrast: '--cv-p-accent-contrast',
  highlight: '--cv-p-highlight',
  danger: '--cv-p-danger',
}

export function parseColor(source: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(source.trim())
  if (hex?.[1]) {
    const value = hex[1]
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
      a: 1,
    }
  }
  const functional = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*(\d+)%)?\s*\)$/.exec(source.trim())
  if (!functional) throw new Error(`unsupported color: ${source}`)
  return {
    r: Number(functional[1]),
    g: Number(functional[2]),
    b: Number(functional[3]),
    a: Number(functional[4] ?? 100) / 100,
  }
}

/** Paints `top` over an opaque `base`; the result is opaque. */
export function over(top: Rgba, base: Rgba): Rgba {
  const mixChannel = (from: number, to: number): number => Math.round(from * top.a + to * (1 - top.a))
  return { r: mixChannel(top.r, base.r), g: mixChannel(top.g, base.g), b: mixChannel(top.b, base.b), a: 1 }
}

/** What `color-mix(in srgb, top <percent>%, transparent)` paints over `base`. */
export function tint(top: Rgba, percent: number, base: Rgba): Rgba {
  return over({ ...top, a: top.a * (percent / 100) }, base)
}

function channelLuminance(channel: number): number {
  const unit = channel / 255
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
}

function luminance(color: Rgba): number {
  return 0.2126 * channelLuminance(color.r) + 0.7152 * channelLuminance(color.g) + 0.0722 * channelLuminance(color.b)
}

/** WCAG 2.x contrast ratio; both colors must already be opaque. */
export function contrastRatio(first: Rgba, second: Rgba): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((left, right) => right - left)
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05)
}

function fallbackOf(declaration: string | undefined): string {
  const match = /^var\(--cv-p-[a-z-]+,\s*(.+)\)$/.exec(declaration ?? '')
  if (!match?.[1]) throw new Error(`no fallback in: ${declaration}`)
  return match[1]
}

function internalVariable(token: TokenName): string {
  return TOKEN_VARIABLE[token].replace('--cv-p-', '--cv-p-i-')
}

/** The default palette as styles.css declares it: the light one on `.cv-p`, the dark one on `.dark .cv-p`. */
export function defaultPalette(theme: 'light' | 'dark'): Palette {
  const light = declarationsIn('.cv-p')
  const dark = theme === 'dark' ? declarationsIn('.dark .cv-p') : new Map<string, string>()
  const entries = (Object.keys(TOKEN_VARIABLE) as TokenName[]).map((token) => {
    const variable = internalVariable(token)
    return [token, parseColor(fallbackOf(dark.get(variable) ?? light.get(variable)))] as const
  })
  return Object.fromEntries(entries) as Palette
}

/** A host mapping: only the tokens it sets; the rest keeps the light defaults, exactly as the cascade would. */
export function mappedPalette(overrides: Partial<Record<TokenName, string>>): Palette {
  const base = defaultPalette('light')
  const entries = (Object.keys(base) as TokenName[]).map((token) => {
    const override = overrides[token]
    return [token, override ? parseColor(override) : base[token]] as const
  })
  return Object.fromEntries(entries) as Palette
}

/** Opaque version of the palette: translucent tokens are painted over the surface they sit on. */
export function flatten(palette: Palette): Palette {
  const entries = (Object.keys(palette) as TokenName[]).map(
    (token) => [token, over(palette[token], palette.surface)] as const,
  )
  return Object.fromEntries(entries) as Palette
}

/** Default value of a standalone token declared on `.cv-p` or `.dark .cv-p` (for example the read tick). */
export function declaredToken(name: string, theme: 'light' | 'dark'): string {
  const value =
    (theme === 'dark' ? declarationsIn('.dark .cv-p').get(name) : undefined) ?? declarationsIn('.cv-p').get(name)
  if (!value) throw new Error(`token not declared: ${name}`)
  return value
}

export { fallbackOf }
