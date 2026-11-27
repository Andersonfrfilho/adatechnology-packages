/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Aparelhos do preview: a largura que cada um ocupa e como o teclado percorre o seletor.
 */

export const PREVIEW_DEVICE = {
  DESKTOP: 'desktop',
  TABLET: 'tablet',
  MOBILE: 'mobile',
} as const
export type PreviewDevice = (typeof PREVIEW_DEVICE)[keyof typeof PREVIEW_DEVICE]

/** Largura do quadro e moldura do `TemplatePreview` que representa cada aparelho de e-mail. */
export const EMAIL_PREVIEW_DEVICES: readonly {
  readonly id: PreviewDevice
  readonly width: number
  readonly viewport: 'browser' | 'ios'
}[] = [
  { id: PREVIEW_DEVICE.DESKTOP, width: 960, viewport: 'browser' },
  { id: PREVIEW_DEVICE.TABLET, width: 768, viewport: 'browser' },
  { id: PREVIEW_DEVICE.MOBILE, width: 375, viewport: 'ios' },
]

export const PHONE_PREVIEW_WIDTH = 375

/** O quadro nunca cresce além do tamanho real: só encolhe para caber, e `zoom` encolhe a caixa junto. */
export function fitZoom(availableWidth: number, frameWidth: number): number {
  if (availableWidth <= 0 || frameWidth <= 0) return 1
  return Math.min(1, availableWidth / frameWidth)
}

const KEY_STEP: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
}

/** Setas andam (e dão a volta), Home/End vão às pontas; outra tecla não muda nada. */
export function nextOptionId(ids: readonly string[], current: string, key: string): string | undefined {
  if (ids.length === 0) return undefined
  if (key === 'Home') return ids[0]
  if (key === 'End') return ids[ids.length - 1]
  const step = KEY_STEP[key]
  if (step === undefined) return undefined
  const index = Math.max(0, ids.indexOf(current))
  return ids[(index + step + ids.length) % ids.length]
}

const HTML_TAG = /<[a-z][\s\S]*>/i

export function looksLikeHtml(body: string): boolean {
  return HTML_TAG.test(body)
}
