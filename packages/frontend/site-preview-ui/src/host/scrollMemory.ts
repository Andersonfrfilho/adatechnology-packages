/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Última posição de rolagem da prévia por chave: sobrevive a trocar de aba/página do painel e a recarregar
 * (sessionStorage, com mapa em memória quando o navegador o recusa).
 */

const STORAGE_PREFIX = 'ada-site-preview:scroll:'
const memory = new Map<string, number>()

export function readPreviewScroll(storageKey: string): number {
  const remembered = memory.get(storageKey)
  if (remembered !== undefined) return remembered
  try {
    const stored = Number(globalThis.sessionStorage?.getItem(STORAGE_PREFIX + storageKey))
    return Number.isFinite(stored) && stored > 0 ? stored : 0
  } catch {
    return 0
  }
}

export function writePreviewScroll(storageKey: string, top: number): void {
  memory.set(storageKey, top)
  try {
    globalThis.sessionStorage?.setItem(STORAGE_PREFIX + storageKey, String(Math.round(top)))
  } catch {
    // Sem armazenamento: vale só enquanto a página estiver aberta.
  }
}
