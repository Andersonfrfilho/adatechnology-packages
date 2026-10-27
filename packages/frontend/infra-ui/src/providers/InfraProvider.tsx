/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { mergeInfraMessages, type InfraMessages, type InfraMessagesOverride } from '../locales'
import type { InfraApi, InfraCapabilities } from './types'

type InfraContextValue = {
  readonly api: InfraApi
  readonly messages: InfraMessages
  readonly capabilities: InfraCapabilities
}

const InfraContext = createContext<InfraContextValue | null>(null)

export type InfraProviderProps = {
  readonly api: InfraApi
  readonly messages?: InfraMessagesOverride
  readonly children: ReactNode
}

export function resolveInfraCapabilities(api: InfraApi): InfraCapabilities {
  return {
    hasEnvironments: api.listEnvironments !== undefined,
    canPower: api.powerOnEnvironment !== undefined && api.powerOffEnvironment !== undefined,
    canSaveSchedule: api.saveSchedule !== undefined,
    hasCosts: api.getCosts !== undefined,
    hasIntegration: api.getIntegration !== undefined,
    canSaveIntegration: api.saveIntegration !== undefined,
    canVerifyIntegration: api.verifyIntegration !== undefined,
    canRemoveIntegration: api.removeIntegration !== undefined,
  }
}

export function InfraProvider({ api, messages, children }: InfraProviderProps) {
  const value = useMemo<InfraContextValue>(
    () => ({ api, messages: mergeInfraMessages(messages), capabilities: resolveInfraCapabilities(api) }),
    [api, messages],
  )

  return <InfraContext.Provider value={value}>{children}</InfraContext.Provider>
}

function useInfraContext(): InfraContextValue {
  const value = useContext(InfraContext)
  if (!value) throw new Error('useInfra() must be used within an <InfraProvider>')
  return value
}

export function useInfraApi(): InfraApi {
  return useInfraContext().api
}

export function useInfraMessages(): InfraMessages {
  return useInfraContext().messages
}

export function useInfraCapabilities(): InfraCapabilities {
  return useInfraContext().capabilities
}

export function requireInfraMethod<TMethod>(method: TMethod | undefined, name: string): TMethod {
  if (method === undefined) throw new Error(`InfraApi.${name} is not implemented by the host`)
  return method
}
