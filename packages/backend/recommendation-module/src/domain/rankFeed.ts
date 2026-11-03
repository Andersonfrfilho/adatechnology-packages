/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A escolha do feed, sem banco: entra a lista de candidatos, sai a ordem. Pura de propósito — é a
 * regra que o anunciante paga para entender, e ela precisa de teste que não dependa de Postgres.
 *
 * As regras, em ordem:
 *
 * 1. Patrocinado vem antes, até o teto do espaço. Um item com duas campanhas no ar aparece uma vez,
 *    pela melhor delas.
 * 2. Entre patrocinados: peso do plano, depois prioridade da campanha, depois sorteio — o sorteio é
 *    o rodízio entre anunciantes que pagaram a mesma coisa.
 * 3. O resto é curadoria: primeiro quem casa com mais tags do pedido, depois o mais recente.
 * 4. Um item nunca aparece duas vezes, mesmo sendo patrocinado e curado ao mesmo tempo.
 */

import type { FeedEntry } from '@adatechnology/recommendation-contracts'

export type SponsoredCandidate = {
  readonly entry: FeedEntry
  readonly planWeight: number
  readonly priority: number
}

export type CuratedCandidate = {
  readonly entry: FeedEntry
  readonly updatedAt: Date
}

export type RankFeedParams = {
  readonly sponsored: readonly SponsoredCandidate[]
  readonly curated: readonly CuratedCandidate[]
  readonly limit: number
  readonly maxSponsored: number
  readonly tags?: readonly string[]
  /** Número em [0, 1). Injetado para o teste ser determinístico. */
  readonly random: () => number
}

function tagMatches(entry: FeedEntry, wanted: ReadonlySet<string>): number {
  if (wanted.size === 0) return 0
  return entry.tags.reduce((count, tag) => count + (wanted.has(tag) ? 1 : 0), 0)
}

export function rankFeed(params: RankFeedParams): FeedEntry[] {
  const limit = Math.max(0, params.limit)
  const maxSponsored = Math.min(limit, Math.max(0, params.maxSponsored))

  // Um sorteio por candidato, fixado ANTES de ordenar: sortear dentro do comparador quebra a
  // transitividade e o `sort` pode devolver qualquer coisa.
  const bestByItem = new Map<string, SponsoredCandidate & { readonly draw: number }>()
  for (const candidate of params.sponsored) {
    const ranked = { ...candidate, draw: params.random() }
    const current = bestByItem.get(candidate.entry.itemId)
    if (!current || compareSponsored(ranked, current) < 0) bestByItem.set(candidate.entry.itemId, ranked)
  }

  const sponsored = [...bestByItem.values()].sort(compareSponsored).slice(0, maxSponsored)
  const taken = new Set(sponsored.map((candidate) => candidate.entry.itemId))

  const wanted = new Set(params.tags ?? [])
  const curated = params.curated
    .filter((candidate) => !taken.has(candidate.entry.itemId))
    .map((candidate) => ({ ...candidate, matches: tagMatches(candidate.entry, wanted) }))
    .sort((a, b) => b.matches - a.matches || b.updatedAt.getTime() - a.updatedAt.getTime())

  const result: FeedEntry[] = sponsored.map((candidate) => candidate.entry)
  for (const candidate of curated) {
    if (result.length >= limit) break
    if (taken.has(candidate.entry.itemId)) continue
    taken.add(candidate.entry.itemId)
    result.push(candidate.entry)
  }

  return result
}

function compareSponsored(
  a: SponsoredCandidate & { readonly draw: number },
  b: SponsoredCandidate & { readonly draw: number },
): number {
  return b.planWeight - a.planWeight || b.priority - a.priority || a.draw - b.draw
}
