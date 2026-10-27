/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { CustomerSettings, CustomersApi } from './types'

type CustomersContextValue = {
  readonly api: CustomersApi
  readonly settings: CustomerSettings | undefined
  readonly settingsError: Error | undefined
  reloadSettings(): void
}

const CustomersContext = createContext<CustomersContextValue | null>(null)

export type CustomersProviderProps = {
  readonly api: CustomersApi
  /**
   * Catálogo já carregado pelo host. Sem ele, o provider busca sozinho — mas o produto que já traz
   * a configuração no boot evita um ida e volta antes da primeira tela pintar.
   */
  readonly settings?: CustomerSettings
  readonly children: ReactNode
}

export function CustomersProvider({ api, settings: initial, children }: CustomersProviderProps) {
  const [settings, setSettings] = useState<CustomerSettings | undefined>(initial)
  const [settingsError, setSettingsError] = useState<Error | undefined>(undefined)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (initial) return

    let cancelled = false
    api
      .getSettings()
      .then((loaded) => {
        if (!cancelled) setSettings(loaded)
      })
      .catch((error: unknown) => {
        // Catálogo que não carrega NÃO vira catálogo vazio: a ficha desenharia sem os campos do
        // produto e o operador salvaria por cima achando que eles não existem.
        if (!cancelled) setSettingsError(error instanceof Error ? error : new Error(String(error)))
      })

    return () => {
      cancelled = true
    }
  }, [api, initial, reloadToken])

  const value = useMemo<CustomersContextValue>(
    () => ({
      api,
      settings,
      settingsError,
      reloadSettings: () => {
        setSettingsError(undefined)
        setReloadToken((token) => token + 1)
      },
    }),
    [api, settings, settingsError],
  )

  return <CustomersContext.Provider value={value}>{children}</CustomersContext.Provider>
}

export function useCustomersApi(): CustomersApi {
  return useCustomersContext().api
}

export function useCustomerSettings(): {
  readonly settings: CustomerSettings | undefined
  readonly error: Error | undefined
  reload(): void
} {
  const context = useCustomersContext()
  return { settings: context.settings, error: context.settingsError, reload: context.reloadSettings }
}

/**
 * O que o produto PODE fazer, derivado do que ele implementou. Centralizado para cada tela não
 * inventar a própria checagem — e para "sem `updateSettings`" significar a mesma coisa em todas.
 */
export function useCustomersCapabilities(): {
  readonly canWrite: boolean
  readonly canEditSettings: boolean
  readonly canEditAddresses: boolean
  readonly canEditDocuments: boolean
} {
  const api = useCustomersApi()

  return useMemo(
    () => ({
      canWrite: Boolean(api.createCustomer && api.updateCustomer),
      canEditSettings: Boolean(api.updateSettings),
      canEditAddresses: Boolean(api.addAddress && api.updateAddress && api.removeAddress),
      canEditDocuments: Boolean(api.setDocument),
    }),
    [api],
  )
}

function useCustomersContext(): CustomersContextValue {
  const value = useContext(CustomersContext)
  if (!value) throw new Error('useCustomersApi() precisa estar dentro de um <CustomersProvider>')
  return value
}
