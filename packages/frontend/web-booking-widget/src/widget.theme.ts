/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import { THEME_TOKEN_TO_CSS_VAR } from './widget.constant'
import type { ThemeTokens } from './types/widget.types'

/**
 * O atributo `theme` é entrada de página de terceiro, tratada como hostil.
 *
 * JSON malformado ou chave desconhecida não pode quebrar o widget: o resultado é só um mapa menor
 * (ou vazio), e a folha de estilo cai no fallback neutro declarado em `widget.style.ts`.
 */
export function parseThemeTokens(rawJson: string | null): ThemeTokens {
  if (!rawJson) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    return {}
  }

  if (typeof parsed !== 'object' || parsed === null) return {}

  const tokens: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (key in THEME_TOKEN_TO_CSS_VAR && typeof value === 'string' && value.trim() !== '') {
      tokens[key] = value
    }
  }

  return tokens
}

/** O host injeta cor pelo atributo, nunca pelo widget: aqui só se traduz token em variável CSS. */
export function applyThemeTokens(element: HTMLElement, tokens: ThemeTokens): void {
  for (const [key, value] of Object.entries(tokens)) {
    const cssVar = THEME_TOKEN_TO_CSS_VAR[key]
    if (cssVar) element.style.setProperty(cssVar, value)
  }
}
