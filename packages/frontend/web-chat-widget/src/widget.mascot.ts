/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

/**
 * A Ada — o mascote que fala pelo bot.
 *
 * Desenhada em SVG inline, e nao em arquivo: o widget e um bundle unico embutido em pagina de
 * terceiro, e uma imagem externa dependeria de `img-src` liberado no CSP do host. Como SVG, ela
 * herda `currentColor` no contorno e acompanha o tema claro/escuro sem segunda arte.
 */
const MASCOT_SVG = `
<svg viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
  <path d="M24 4v5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
  <circle cx="24" cy="3.5" r="2.5" fill="var(--ada-cyan)" />
  <rect x="6" y="9" width="36" height="30" rx="12" fill="currentColor" />
  <rect x="12" y="16" width="24" height="14" rx="7" fill="var(--ada-visor)" />
  <circle class="mascot-eye" cx="19" cy="23" r="2.6" fill="var(--ada-cyan)" />
  <circle class="mascot-eye" cx="29" cy="23" r="2.6" fill="var(--ada-cyan)" />
  <path d="M20.5 33.5c2.2 1.6 4.8 1.6 7 0" stroke="var(--ada-visor)" stroke-width="2"
    stroke-linecap="round" />
  <rect x="1" y="19" width="4" height="10" rx="2" fill="currentColor" opacity=".7" />
  <rect x="43" y="19" width="4" height="10" rx="2" fill="currentColor" opacity=".7" />
</svg>
`

/**
 * `innerHTML` aqui e sobre uma constante do proprio bundle, sem interpolacao de nada.
 *
 * A regra que proibe `innerHTML` no widget existe por causa do texto do fluxo, que e editado no
 * painel e chega pela rede; este markup nao atravessa fronteira nenhuma. Para SVG, `createElementNS`
 * no atributo por atributo custaria trinta linhas sem ganhar seguranca alguma.
 */
export function buildMascot(className: string): HTMLElement {
  const holder = document.createElement('span')
  holder.className = className
  holder.innerHTML = MASCOT_SVG

  return holder
}
