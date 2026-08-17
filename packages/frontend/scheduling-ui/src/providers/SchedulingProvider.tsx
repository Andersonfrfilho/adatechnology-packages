/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { DEFAULT_SCHEDULING_UI_CONFIG, type SchedulingApi, type SchedulingUiConfig } from './types'

type SchedulingContextValue = {
  readonly api: SchedulingApi
  readonly config: SchedulingUiConfig
}

const SchedulingContext = createContext<SchedulingContextValue | null>(null)

export type SchedulingProviderProps = {
  readonly api: SchedulingApi
  readonly config?: Partial<SchedulingUiConfig>
  readonly children: ReactNode
}

export function SchedulingProvider({ api, config, children }: SchedulingProviderProps) {
  const value = useMemo<SchedulingContextValue>(
    () => ({ api, config: { ...DEFAULT_SCHEDULING_UI_CONFIG, ...config } }),
    [api, config],
  )

  return <SchedulingContext.Provider value={value}>{children}</SchedulingContext.Provider>
}

export function useScheduling(): SchedulingApi {
  return useSchedulingContext().api
}

export function useSchedulingConfig(): SchedulingUiConfig {
  return useSchedulingContext().config
}

function useSchedulingContext(): SchedulingContextValue {
  const value = useContext(SchedulingContext)
  if (!value) {
    throw new Error('useScheduling() must be used within a <SchedulingProvider>')
  }
  return value
}
