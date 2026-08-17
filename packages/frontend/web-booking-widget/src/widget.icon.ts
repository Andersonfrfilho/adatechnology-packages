/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/**
 * Ícones em SVG inline, herdando `currentColor` (`web.md` §9) — nada de emoji em UI de produto.
 *
 * Constante do bundle, sem interpolação de nada que atravesse a rede: `innerHTML` aqui não é vetor
 * de injeção porque o conteúdo nunca depende de dado remoto.
 */
const CALENDAR_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <rect x="3" y="5" width="18" height="16" rx="2" />
  <path d="M3 10h18M8 3v4M16 3v4" />
</svg>
`

const CHEVRON_LEFT_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M15 18l-6-6 6-6" />
</svg>
`

const CHECK_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M20 6 9 17l-5-5" />
</svg>
`

const ICONS = {
  calendar: CALENDAR_SVG,
  chevronLeft: CHEVRON_LEFT_SVG,
  check: CHECK_SVG,
} as const

export type IconName = keyof typeof ICONS

export function applyIcon(target: HTMLElement, name: IconName): void {
  target.innerHTML = ICONS[name]
}
