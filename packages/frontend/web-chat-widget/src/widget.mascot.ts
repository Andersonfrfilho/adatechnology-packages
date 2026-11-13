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
 * E a propria marca em movimento: a rede triangular do logo, com o nucleo hexagonal no centro.
 * Um robozinho generico seria simpatico e de ninguem; a malha de nos e o que a pessoa ja viu no
 * cabecalho do site, entao o chat nasce reconhecido em vez de parecer um plugin de terceiro.
 *
 * Desenhada em SVG inline, e nao em arquivo: o widget e um bundle unico embutido em pagina de
 * terceiro, e uma imagem externa dependeria de `img-src` liberado no CSP do host. Como SVG, a
 * malha herda `currentColor` e o acento vem de `--ada-mascot-accent`, que cada contexto redefine
 * — sobre o gradiente azul do launcher o ciano do logo sumiria.
 */
const MASCOT_SVG = `
<svg viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
  <g stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
    <path d="M24 5 6 41h36L24 5Z" />
    <path d="M15 23h18" opacity=".7" />
    <g class="mascot-mesh" opacity=".5">
      <path d="M24 5v36" />
      <path d="M6 41 33 23" />
      <path d="M42 41 15 23" />
    </g>
  </g>
  <g class="mascot-core">
    <path d="M24 21.2l5.2 3v6l-5.2 3-5.2-3v-6l5.2-3Z" stroke="var(--ada-mascot-accent)"
      stroke-width="1.8" stroke-linejoin="round" />
    <circle cx="24" cy="27.2" r="2.2" fill="var(--ada-mascot-accent)" />
  </g>
  <g fill="var(--ada-mascot-accent)">
    <circle class="mascot-node node-a" cx="24" cy="5" r="2.6" />
    <circle class="mascot-node node-b" cx="6" cy="41" r="2.4" />
    <circle class="mascot-node node-c" cx="42" cy="41" r="2.4" />
    <circle class="mascot-node node-b" cx="15" cy="23" r="1.9" />
    <circle class="mascot-node node-c" cx="33" cy="23" r="1.9" />
    <circle class="mascot-node node-a" cx="24" cy="41" r="1.9" />
  </g>
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
