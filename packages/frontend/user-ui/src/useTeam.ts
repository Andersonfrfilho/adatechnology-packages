/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O estado da tela de equipe: listagem paginada, criação e ativação.
 *
 * `enabled` é derivado da presença dos métodos na `UserApi`, e não de uma flag: quem não expõe as
 * rotas de admin do `user-module` não precisa dizer duas vezes que a tela não existe.
 */

import { useCallback, useEffect, useState } from 'react'

import { useOptionalUserApi } from './providers/UserProvider'
import type { CreateTeamMemberInput, TeamPage, UserApi, UserProfile } from './providers/types'

export const TEAM_DEFAULT_PAGE_SIZE = 20

/** As colunas que ordenam — e so elas: cabecalho clicavel que nao ordena e promessa quebrada. */
export const TEAM_SORT_FIELDS = {
  NAME: 'name',
  EMAIL: 'email',
  ROLE: 'role',
  ACTIVE: 'isActive',
} as const
export type TeamSortField = (typeof TEAM_SORT_FIELDS)[keyof typeof TEAM_SORT_FIELDS]

export type TeamSort = {
  readonly field: TeamSortField
  readonly direction: 'asc' | 'desc'
}

export type UseTeamResult = {
  /** O termo de busca corrente. Filtra sobre nome e e-mail — quem procura lembra de um dos dois. */
  readonly search: string
  /** Ids marcados. `Set` e nao array: a tabela pergunta "esta marcado?" por linha, a cada render. */
  readonly selected: ReadonlySet<string>
  readonly allVisibleSelected: boolean
  /** `true` quando ha busca aplicada — e o que faz o botao de limpar aparecer (web.md §7). */
  readonly hasFilters: boolean
  /** Ausente = ordem natural, que e a que o servidor devolveu. E o terceiro estado do cabecalho. */
  readonly sort: TeamSort | undefined
  /** Cicla `asc` -> `desc` -> neutro na mesma coluna; outra coluna recomeca em `asc`. */
  toggleSort: (field: TeamSortField) => void
  setSearch: (value: string) => void
  clearFilters: () => void
  toggleSelected: (userId: string) => void
  toggleAllVisible: () => void
  clearSelection: () => void
  setSelectedActive: (isActive: boolean) => Promise<void>
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

/** Só os três métodos de equipe — quem monta a tela sozinho não precisa dos de autenticação. */
export type TeamApi = Pick<UserApi, 'listTeam' | 'createTeamMember' | 'setTeamMemberActive'>

export type UseTeamParams = {
  readonly pageSize?: number
  /** Substitui a `UserApi` do contexto. Presente, nenhum `UserProvider` é necessário. */
  readonly api?: TeamApi
}

export function useTeam({ pageSize = TEAM_DEFAULT_PAGE_SIZE, api: override }: UseTeamParams = {}): UseTeamResult {
  const contextApi = useOptionalUserApi()
  const api: TeamApi = override ?? contextApi ?? {}
  const [page, setPage] = useState(1)
  const [data, setData] = useState<TeamPage>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [search, setSearchValue] = useState('')
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [sort, setSort] = useState<TeamSort | undefined>(undefined)

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

  /**
   * Busca no CLIENTE, sobre a pagina carregada.
   *
   * A alternativa e mandar o termo para o servidor, e ela e a certa quando a base cresce — mas o
   * `listTeam` de hoje devolve a equipe inteira, e filtrar duas vezes o mesmo conjunto seria uma ida
   * de rede por tecla digitada sem nada em troca. Quando houver paginacao real do servidor, o termo
   * passa a ir junto de `page` e este bloco sai.
   */
  const termo = search.trim().toLowerCase()
  const members = termo
    ? (data?.items ?? []).filter((member) => `${member.name} ${member.email}`.toLowerCase().includes(termo))
    : (data?.items ?? [])

  /**
   * Ordena so quando alguem pede. Sem `sort`, vale a ordem do servidor — que ja poe ativos primeiro,
   * e reordenar por padrao esconderia essa intencao.
   */
  const ordered = sort ? [...members].sort(compareBy(sort)) : members

  const visibleIds = ordered.map((member) => member.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))

  return {
    enabled,
    members: ordered,
    total: data?.total ?? 0,
    search,
    selected,
    allVisibleSelected,
    hasFilters: termo.length > 0 || sort !== undefined,
    sort,
    toggleSort: (field: TeamSortField) =>
      setSort((current) => {
        if (current?.field !== field) return { field, direction: 'asc' }
        if (current.direction === 'asc') return { field, direction: 'desc' }
        return undefined
      }),
    setSearch: (value: string) => {
      setSearchValue(value)
      // Selecao morre com o filtro: manter marcado o que sumiu da tela e agir em lote sobre gente
      // que o operador nao esta vendo.
      setSelected(new Set())
    },
    clearFilters: () => {
      setSearchValue('')
      setSort(undefined)
      setSelected(new Set())
    },
    toggleSelected: (userId: string) =>
      setSelected((current) => {
        const next = new Set(current)
        if (next.has(userId)) next.delete(userId)
        else next.add(userId)
        return next
      }),
    toggleAllVisible: () =>
      setSelected((current) => (visibleIds.every((id) => current.has(id)) ? new Set() : new Set(visibleIds))),
    clearSelection: () => setSelected(new Set()),
    setSelectedActive: async (isActive: boolean) => {
      if (!api.setTeamMemberActive) return
      setSaving(true)
      setError(undefined)
      try {
        /**
         * Em serie, e nao em paralelo: sao escritas no mesmo recurso, e disparar dez de uma vez
         * multiplica o risco de o rate limit derrubar metade — deixando o operador sem saber quais
         * mudaram.
         */
        for (const id of selected) {
          await api.setTeamMemberActive(id, isActive)
        }
        setSelected(new Set())
        await load()
      } catch (cause) {
        setError(messageOf(cause, 'Nao foi possivel alterar'))
        await load()
      } finally {
        setSaving(false)
      }
    },
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

/**
 * `isActive` ordena por situacao, e nao alfabeticamente sobre "true"/"false".
 *
 * Ativo primeiro no `asc` porque e o que quem administra procura — a lista de quem trabalha, nao a
 * de quem saiu.
 */
export function compareBy(sort: TeamSort): (left: UserProfile, right: UserProfile) => number {
  const sinal = sort.direction === 'asc' ? 1 : -1

  return (left, right) => {
    if (sort.field === TEAM_SORT_FIELDS.ACTIVE) {
      return (Number(right.isActive) - Number(left.isActive)) * sinal
    }

    return String(left[sort.field] ?? '').localeCompare(String(right[sort.field] ?? '')) * sinal
  }
}
