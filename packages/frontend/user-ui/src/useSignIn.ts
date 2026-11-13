/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useCallback, useState } from 'react'

import { useUserApi, useUserSession } from './providers/UserProvider'
import type { SignInParams } from './providers/types'

export type UseSignInResult = {
  readonly loading: boolean
  readonly error: string | undefined
  readonly signIn: (params: SignInParams) => Promise<void>
}

export function useSignIn(): UseSignInResult {
  const api = useUserApi()
  const { setUser } = useUserSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const signIn = useCallback(
    async (params: SignInParams) => {
      setLoading(true)
      setError(undefined)
      try {
        const session = await api.signIn(params)
        setUser(session.user)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível entrar')
        throw cause
      } finally {
        setLoading(false)
      }
    },
    [api, setUser],
  )

  return { loading, error, signIn }
}
