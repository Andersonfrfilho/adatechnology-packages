/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type PageItem = { readonly kind: 'page'; readonly page: number } | { readonly kind: 'gap'; readonly key: string }

/**
 * Páginas visíveis: primeira, última e vizinhas da atual, com reticências nos buracos. Em 375px
 * cabe uma janela de 5 números; listar 40 páginas quebraria a linha.
 */
export function buildPageItems(params: {
  readonly current: number
  readonly total: number
  readonly siblings?: number
}): PageItem[] {
  const siblings = params.siblings ?? 1
  const total = Math.max(1, params.total)
  const current = Math.min(Math.max(1, params.current), total)
  const pages = new Set<number>([1, total])
  for (let page = current - siblings; page <= current + siblings; page += 1) {
    if (page >= 1 && page <= total) pages.add(page)
  }

  const items: PageItem[] = []
  let previous = 0
  for (const page of [...pages].sort((left, right) => left - right)) {
    if (page - previous > 1) items.push({ kind: 'gap', key: `gap-${previous}` })
    items.push({ kind: 'page', page })
    previous = page
  }
  return items
}

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
