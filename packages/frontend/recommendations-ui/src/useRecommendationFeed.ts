/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { useRecommendationsApi } from './providers/RecommendationsProvider'
import type { FeedEntry, FeedQuery, RecommendationEventType } from './providers/types'

export type UseRecommendationFeedResult = {
  readonly entries: readonly FeedEntry[]
  readonly loading: boolean
  readonly error: Error | undefined
  reload(): void
  /** Conta a impressão UMA vez por item enquanto o feed estiver carregado. */
  trackImpression(entry: FeedEntry): void
  trackClick(entry: FeedEntry): void
}

/**
 * `query` entra por valor (placement, cidade, idade, tags), não por identidade: o host que monta o
 * objeto a cada render não dispara uma busca por render.
 */
export function useRecommendationFeed(query: FeedQuery & { readonly enabled?: boolean }): UseRecommendationFeedResult {
  const api = useRecommendationsApi()
  const [entries, setEntries] = useState<readonly FeedEntry[]>([])
  const [loading, setLoading] = useState(query.enabled !== false)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [reloadToken, setReloadToken] = useState(0)
  const seen = useRef(new Set<string>())

  const key = JSON.stringify([query.placement, query.kind, query.city, query.age, query.tags, query.limit])

  useEffect(() => {
    if (query.enabled === false) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(undefined)
    seen.current = new Set()

    const { enabled, ...feedQuery } = query
    void enabled
    api
      .getFeed(feedQuery)
      .then((feed) => {
        if (!cancelled) setEntries(feed.entries)
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason : new Error(String(reason)))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // `key` resume a query por valor; a lista de dependências é ela, e não o objeto.
  }, [api, key, query.enabled, reloadToken])

  const send = useCallback(
    (entry: FeedEntry, type: RecommendationEventType) => {
      // Métrica nunca derruba a tela: falha de rastreio é silenciosa para quem está vendo.
      api
        .trackEvent({ itemId: entry.itemId, campaignId: entry.campaignId, placement: query.placement, type })
        .catch(() => undefined)
    },
    [api, query.placement],
  )

  const trackImpression = useCallback(
    (entry: FeedEntry) => {
      if (seen.current.has(entry.itemId)) return
      seen.current.add(entry.itemId)
      send(entry, 'impression')
    },
    [send],
  )

  const trackClick = useCallback((entry: FeedEntry) => send(entry, 'click'), [send])

  return {
    entries,
    loading,
    error,
    reload: () => setReloadToken((token) => token + 1),
    trackImpression,
    trackClick,
  }
}
