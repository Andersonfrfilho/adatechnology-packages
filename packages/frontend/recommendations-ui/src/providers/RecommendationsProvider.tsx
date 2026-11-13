/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { DEFAULT_LABELS, type RecommendationLabels } from '../lib/labels'
import type { RecommendationsApi } from './types'

type RecommendationsContextValue = {
  readonly api: RecommendationsApi
  readonly labels: RecommendationLabels
}

const RecommendationsContext = createContext<RecommendationsContextValue | null>(null)

export type RecommendationsProviderProps = {
  readonly api: RecommendationsApi
  /** Textos da tela. O padrão é pt-BR; o host troca só o que quiser. */
  readonly labels?: Partial<RecommendationLabels>
  readonly children: ReactNode
}

export function RecommendationsProvider({ api, labels, children }: RecommendationsProviderProps) {
  const value = useMemo<RecommendationsContextValue>(
    () => ({ api, labels: { ...DEFAULT_LABELS, ...labels } }),
    [api, labels],
  )
  return <RecommendationsContext.Provider value={value}>{children}</RecommendationsContext.Provider>
}

function useRecommendationsContext(): RecommendationsContextValue {
  const context = useContext(RecommendationsContext)
  if (!context) throw new Error('Use os componentes de recomendação dentro de <RecommendationsProvider>.')
  return context
}

export function useRecommendationsApi(): RecommendationsApi {
  return useRecommendationsContext().api
}

export function useRecommendationLabels(): RecommendationLabels {
  return useRecommendationsContext().labels
}
