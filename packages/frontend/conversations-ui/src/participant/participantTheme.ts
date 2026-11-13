import type { CSSProperties } from 'react'

import type { ConversationsTheme } from '../types'

const THEME_TO_VARIABLE = {
  primaryColor: '--cv-p-accent',
  backgroundColor: '--cv-p-surface',
  textPrimary: '--cv-p-text',
  textSecondary: '--cv-p-text-muted',
} as const

export function buildParticipantThemeStyle(theme: ConversationsTheme | undefined): CSSProperties | undefined {
  if (!theme) return undefined
  const style: Record<string, string> = {}
  for (const [key, variable] of Object.entries(THEME_TO_VARIABLE)) {
    const value = theme[key as keyof typeof THEME_TO_VARIABLE]
    if (value) style[variable] = value
  }
  return Object.keys(style).length > 0 ? (style as CSSProperties) : undefined
}
