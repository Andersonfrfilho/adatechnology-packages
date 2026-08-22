/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Diferente do `ProductsProvider` (sem estado), este provider é stateful: guarda a sessão do
 * usuário logado e tenta um bootstrap via `api.getProfile()` na montagem, porque toda a UI de
 * conta/autenticação depende de saber "quem está logado agora" antes de renderizar.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { DEFAULT_USER_CONFIG, SESSION_STATUS, type SessionStatus, type UserApi, type UserConfig, type UserProfile } from './types'

type UserContextValue = {
  readonly api: UserApi
  readonly config: UserConfig
  readonly status: SessionStatus
  readonly user: UserProfile | undefined
  readonly setUser: (user: UserProfile | undefined) => void
  readonly refresh: () => Promise<void>
}

const UserContext = createContext<UserContextValue | null>(null)

export type UserProviderProps = {
  readonly api: UserApi
  readonly config?: Partial<UserConfig>
  readonly children: ReactNode
}

export function UserProvider({ api, config, children }: UserProviderProps) {
  const resolvedConfig = useMemo<UserConfig>(() => ({ ...DEFAULT_USER_CONFIG, ...config }), [config])
  const [user, setUserState] = useState<UserProfile | undefined>(undefined)
  const [status, setStatus] = useState<SessionStatus>(resolvedConfig.autoFetchProfile ? SESSION_STATUS.LOADING : SESSION_STATUS.UNAUTHENTICATED)

  const refresh = useCallback(async () => {
    setStatus(SESSION_STATUS.LOADING)
    try {
      const profile = await api.getProfile()
      setUserState(profile)
      setStatus(SESSION_STATUS.AUTHENTICATED)
    } catch {
      setUserState(undefined)
      setStatus(SESSION_STATUS.UNAUTHENTICATED)
    }
  }, [api])

  useEffect(() => {
    if (resolvedConfig.autoFetchProfile) void refresh()
  }, [resolvedConfig.autoFetchProfile, refresh])

  const setUser = useCallback((nextUser: UserProfile | undefined) => {
    setUserState(nextUser)
    setStatus(nextUser ? SESSION_STATUS.AUTHENTICATED : SESSION_STATUS.UNAUTHENTICATED)
  }, [])

  const value = useMemo<UserContextValue>(
    () => ({ api, config: resolvedConfig, status, user, setUser, refresh }),
    [api, resolvedConfig, status, user, setUser, refresh],
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser(): { readonly status: SessionStatus; readonly user: UserProfile | undefined } {
  const { status, user } = useUserContext()
  return { status, user }
}

export function useUserConfig(): UserConfig {
  return useUserContext().config
}

export function useUserApi(): UserApi {
  return useUserContext().api
}

/** Uso interno dos hooks de fluxo (`useSignIn`, `usePasswordReset`, `useProfile`) para atualizar a sessão. */
export function useUserSession(): { readonly setUser: (user: UserProfile | undefined) => void; readonly refresh: () => Promise<void> } {
  const { setUser, refresh } = useUserContext()
  return { setUser, refresh }
}

function useUserContext(): UserContextValue {
  const value = useContext(UserContext)
  if (!value) {
    throw new Error('useUser() must be used within a <UserProvider>')
  }
  return value
}
