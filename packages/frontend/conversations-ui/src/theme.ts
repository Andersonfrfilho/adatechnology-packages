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

/**
 * Texto do chat nos dois temas.
 *
 * Existe porque as cores viviam cravadas em hexadecimal na marcação, sem variante escura: nome do
 * cliente em `#111b21` e número, horário e prévia em `#667781` — os cinzas do WhatsApp CLARO. Com o
 * tema escuro ligado eles continuavam escuros sobre fundo escuro, e a lista virava texto quase
 * ilegível. O mesmo par aparecia dentro do balão, que também escurece.
 *
 * Os valores escuros são os que o próprio WhatsApp usa, para a tela não inventar uma paleta própria.
 */
export const CHAT_TEXT_PRIMARY_CLASS = 'text-[#111b21] dark:text-[#e9edef]'
export const CHAT_TEXT_SECONDARY_CLASS = 'text-[#667781] dark:text-[#8696a0]'
