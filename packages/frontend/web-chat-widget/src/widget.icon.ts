/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

/**
 * Icones da barra de composicao, em SVG inline.
 *
 * Emoji nao serve em UI de produto (`web.md` §9): o 🎤 sai colorido e chapado em cada sistema,
 * ignora `currentColor` e nao acompanha o estado do botao — gravando, desabilitado, hover. Em SVG
 * o traco herda a cor do botao e escala com o token de tipografia.
 *
 * Mesma justificativa de `widget.mascot.ts` para o `innerHTML`: constante do bundle, sem
 * interpolacao de nada que atravesse a rede.
 */
const MICROPHONE_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <rect x="9" y="3" width="6" height="11" rx="3" />
  <path d="M5 11a7 7 0 0 0 14 0" />
  <path d="M12 18v3" />
</svg>
`

const SEND_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M4 12 20 4l-8 16-2.2-6.2L4 12Z" />
</svg>
`

const ICONS = {
  microphone: MICROPHONE_SVG,
  send: SEND_SVG,
} as const

export type IconName = keyof typeof ICONS

export function applyIcon(target: HTMLElement, name: IconName): void {
  target.innerHTML = ICONS[name]
}
