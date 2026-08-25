/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O estado da tela de equipe: listagem paginada, criação e ativação.
 *
 * `enabled` é derivado da presença dos métodos na `UserApi`, e não de uma flag: quem não expõe as
 * rotas de admin do `user-module` não precisa dizer duas vezes que a tela não existe.
 */

import { useCallback, useEffect, useState } from 'react'

import { useUserApi } from './providers/UserProvider'
import type { CreateTeamMemberInput, TeamPage, UserProfile } from './providers/types'

export const TEAM_DEFAULT_PAGE_SIZE = 20

export type UseTeamResult = {
  /** `false` quando a `UserApi` não traz `listTeam` — a tela inteira some. */
  readonly enabled: boolean
  readonly members: readonly UserProfile[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly loading: boolean
  readonly saving: boolean
  readonly error: string | undefined
  readonly canDeactivate: boolean
  goToPage: (page: number) => void
  createMember: (input: CreateTeamMemberInput) => Promise<UserProfile | undefined>
  setMemberActive: (userId: string, isActive: boolean) => Promise<void>
  reload: () => void
}

export function useTeam(pageSize: number = TEAM_DEFAULT_PAGE_SIZE): UseTeamResult {
  const api = useUserApi()
  const [page, setPage] = useState(1)
  const [data, setData] = useState<TeamPage>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const listTeam = api.listTeam
  const enabled = Boolean(listTeam)

  const load = useCallback(async () => {
    if (!listTeam) return
    setLoading(true)
    setError(undefined)
    try {
      setData(await listTeam({ page, pageSize }))
    } catch (cause) {
      setError(messageOf(cause, 'Não foi possível carregar a equipe'))
    } finally {
      setLoading(false)
    }
  }, [listTeam, page, pageSize])

  useEffect(() => {
    void load()
  }, [load])

  const createMember = useCallback(
    async (input: CreateTeamMemberInput) => {
      if (!api.createTeamMember) return undefined
      setSaving(true)
      setError(undefined)
      try {
        const created = await api.createTeamMember(input)
        /**
         * Recarrega em vez de inserir na lista local: o servidor normaliza o e-mail, atribui o id e
         * decide a ordem. Uma linha montada aqui divergiria dela na primeira paginação.
         */
        await load()
        return created
      } catch (cause) {
        setError(messageOf(cause, 'Não foi possível criar'))
        return undefined
      } finally {
        setSaving(false)
      }
    },
    [api, load],
  )

  const setMemberActive = useCallback(
    async (userId: string, isActive: boolean) => {
      if (!api.setTeamMemberActive) return
      setSaving(true)
      setError(undefined)
      try {
        await api.setTeamMemberActive(userId, isActive)
        await load()
      } catch (cause) {
        setError(messageOf(cause, 'Não foi possível alterar'))
      } finally {
        setSaving(false)
      }
    },
    [api, load],
  )

  return {
    enabled,
    members: data?.items ?? [],
    total: data?.total ?? 0,
    page,
    pageSize,
    loading,
    saving,
    error,
    canDeactivate: Boolean(api.setTeamMemberActive),
    goToPage: setPage,
    createMember,
    setMemberActive,
    reload: () => void load(),
  }
}

function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback
}
