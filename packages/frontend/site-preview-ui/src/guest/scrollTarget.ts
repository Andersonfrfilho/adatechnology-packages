/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

const EDGE_MARGIN = 16
const TALL_RATIO = 0.9

export type ScrollTargetParams = {
  /** `getBoundingClientRect().top` da seção (relativo à janela). */
  readonly elementTop: number
  readonly elementHeight: number
  readonly viewportHeight: number
  readonly currentScrollTop: number
  readonly documentHeight: number
}

/**
 * Para onde rolar para a seção ficar visível: `undefined` quando ela já cabe na janela (não mexe),
 * centralizada quando é menor que a janela, alinhada ao topo quando é do tamanho dela ou maior.
 */
export function computeScrollTop(params: ScrollTargetParams): number | undefined {
  const { elementTop, elementHeight, viewportHeight, currentScrollTop, documentHeight } = params
  const isFullyVisible = elementTop >= EDGE_MARGIN && elementTop + elementHeight <= viewportHeight - EDGE_MARGIN
  if (isFullyVisible) return undefined
  const absoluteTop = currentScrollTop + elementTop
  const isTall = elementHeight >= viewportHeight * TALL_RATIO
  const target = isTall ? absoluteTop - EDGE_MARGIN : absoluteTop - (viewportHeight - elementHeight) / 2
  const maximum = Math.max(0, documentHeight - viewportHeight)
  const clamped = Math.min(maximum, Math.max(0, Math.round(target)))
  return clamped === Math.round(currentScrollTop) ? undefined : clamped
}
