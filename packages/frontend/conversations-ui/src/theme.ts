import type { ConversationsTheme } from './types'

const themeCache = new Map<string, string>()

export function getThemeClass(defaultClass: string, themeKey?: string, theme?: ConversationsTheme): string {
  if (!themeKey || !theme) return defaultClass

  const cacheKey = `${defaultClass}:${themeKey}`
  if (themeCache.has(cacheKey)) return themeCache.get(cacheKey)!

  const value = (theme as Record<string, string | undefined>)[themeKey]
  const result = value ?? defaultClass
  themeCache.set(cacheKey, result)
  return result
}

export function getCustomStyles(theme?: ConversationsTheme): Record<string, string> {
  if (!theme) return {}

  const styles: Record<string, string> = {}

  if (theme.primaryColor) styles['--cv-primary'] = theme.primaryColor
  if (theme.backgroundColor) styles['--cv-bg'] = theme.backgroundColor
  if (theme.bubbleSent) styles['--cv-bubble-sent'] = theme.bubbleSent
  if (theme.bubbleReceived) styles['--cv-bubble-received'] = theme.bubbleReceived
  if (theme.textPrimary) styles['--cv-text-primary'] = theme.textPrimary
  if (theme.textSecondary) styles['--cv-text-secondary'] = theme.textSecondary

  return styles
}
