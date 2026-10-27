/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Onde um menu flutuante do editor pode aparecer sem sair da tela.
 *
 * Existe porque tanto o menu do "+" quanto os submenus dele eram posicionados por uma âncora crua:
 * o menu em `fixed` na coordenada do clique, os submenus em `left-full top-0`. Card perto da borda
 * direita jogava o menu para fora; item de ação perto do rodapé cortava a lista no meio, e não havia
 * como rolar nem alcançar o resto — o menu ficava preso contra a borda.
 *
 * A conta é pura de propósito: é ela que decide se o operador consegue clicar na opção, e testá-la
 * exige apenas números.
 */

/** Retângulo do gatilho. Um clique é um retângulo de tamanho zero. */
export type AnchorRect = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export type PanelSize = {
  readonly width: number
  readonly height: number
}

export type ViewportSize = {
  readonly width: number
  readonly height: number
}

export type FloatingPlacement = {
  readonly left: number
  readonly top: number
  /** Teto de altura: acima disso o painel rola por dentro em vez de vazar pelo rodapé. */
  readonly maxHeight: number
}

export type PlaceFloatingPanelParams = {
  readonly anchor: AnchorRect
  readonly panel: PanelSize
  readonly viewport: ViewportSize
  /** `side`: submenu sai ao lado do item; `below`: menu sai abaixo do ponto clicado. */
  readonly prefer: 'side' | 'below'
  readonly gap?: number
  readonly margin?: number
}

const DEFAULT_GAP = 4
const DEFAULT_MARGIN = 8

function clamp(value: number, minimum: number, maximum: number): number {
  // `maximum` menor que `minimum` acontece com painel maior que a viewport: a margem de cima manda,
  // porque cortar em cima esconde o começo da lista.
  return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)))
}

export function placeFloatingPanel({
  anchor,
  panel,
  viewport,
  prefer,
  gap = DEFAULT_GAP,
  margin = DEFAULT_MARGIN,
}: PlaceFloatingPanelParams): FloatingPlacement {
  const maxHeight = Math.min(panel.height, viewport.height - margin * 2)

  let left: number
  if (prefer === 'side') {
    // Vira para a esquerda quando não cabe à direita — o inverso de escolher sempre um lado.
    const toTheRight = anchor.right + gap
    const toTheLeft = anchor.left - gap - panel.width
    left = toTheRight + panel.width <= viewport.width - margin ? toTheRight : toTheLeft
  } else {
    left = anchor.left + gap
  }
  left = clamp(left, margin, viewport.width - margin - panel.width)

  const top = prefer === 'side' ? anchor.top : anchor.bottom
  return {
    left,
    top: clamp(top, margin, viewport.height - margin - maxHeight),
    maxHeight,
  }
}
