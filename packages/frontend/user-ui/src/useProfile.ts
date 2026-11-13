/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useCallback, useState } from 'react'

import { useUser, useUserApi, useUserSession } from './providers/UserProvider'
import type { UpdateProfileInput, UserProfile } from './providers/types'

export type UseProfileResult = {
  readonly profile: UserProfile | undefined
  readonly loading: boolean
  readonly error: string | undefined
  readonly updateProfile: (input: UpdateProfileInput) => Promise<void>
}

export function useProfile(): UseProfileResult {
  const api = useUserApi()
  const { user } = useUser()
  const { setUser } = useUserSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      setLoading(true)
      setError(undefined)
      try {
        const profile = await api.updateProfile(input)
        setUser(profile)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o perfil')
        throw cause
      } finally {
        setLoading(false)
      }
    },
    [api, setUser],
  )

  return { profile: user, loading, error, updateProfile }
}
