/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useCallback, useState } from 'react'

import { useUserApi, useUserSession } from './providers/UserProvider'
import type { SignUpParams } from './providers/types'

export type UseSignUpResult = {
  /** `false` quando a `UserApi` não traz `signUp` — o formulário não deve ser oferecido. */
  readonly enabled: boolean
  readonly loading: boolean
  readonly error: string | undefined
  readonly signUp: (params: SignUpParams) => Promise<void>
}

export function useSignUp(): UseSignUpResult {
  const api = useUserApi()
  const { setUser } = useUserSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const signUp = useCallback(
    async (params: SignUpParams) => {
      if (!api.signUp) return
      setLoading(true)
      setError(undefined)
      try {
        const session = await api.signUp(params)
        setUser(session.user)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível criar a conta')
        throw cause
      } finally {
        setLoading(false)
      }
    },
    [api, setUser],
  )

  return { enabled: Boolean(api.signUp), loading, error, signUp }
}
