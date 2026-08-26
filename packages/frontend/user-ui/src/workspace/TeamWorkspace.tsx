/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A tela COMPOSTA de equipe (`pluggable-module.md` §4): listagem paginada, cadastro e ativação.
 *
 * Ela some inteira quando a `UserApi` não traz `listTeam`. Capacidade por ausência, e não uma flag:
 * quem não expõe as rotas de admin do `user-module` não precisa dizer duas vezes.
 */

import { useState, type ReactNode } from 'react'

import { TeamMemberForm } from '../TeamMemberForm'
import { useTeam, type TeamApi } from '../useTeam'
import { DEFAULT_USER_LABELS, type UserLabels } from './labels'

export type TeamWorkspaceProps = {
  readonly labels?: Partial<UserLabels>
  readonly header?: ReactNode
  /** Quantas linhas por página. O padrão do hook cobre uma equipe inteira sem paginar. */
  readonly pageSize?: number
  /**
   * Os três métodos de equipe, quando o host não usa o `UserProvider` deste pacote.
   *
   * É o caso de quem já resolve sessão por conta própria e quer só esta tela — sem isto, seria
   * preciso um provider com os seis métodos de autenticação só para satisfazer o contexto.
   */
  readonly api?: TeamApi
}

const CELL = 'px-4 py-3 text-sm text-gray-900 dark:text-gray-100'

export function TeamWorkspace({ labels: overrides, header, pageSize, api }: TeamWorkspaceProps) {
  const labels = { ...DEFAULT_USER_LABELS, ...overrides }
  const team = useTeam({ ...(pageSize === undefined ? {} : { pageSize }), ...(api ? { api } : {}) })
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [createdName, setCreatedName] = useState<string>()

  if (!team.enabled) return null

  const lastPage = Math.max(1, Math.ceil(team.total / team.pageSize))

  async function handleCreate(input: Parameters<typeof team.createMember>[0]): Promise<void> {
    const created = await team.createMember(input)
    if (!created) return
    setCreatedName(created.name)
    setIsFormOpen(false)
  }

  return (
    <div className="space-y-6">
      {header}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{labels.teamTitle}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{labels.teamSubtitle}</p>
        </div>

        {/* Sem `createTeamMember` na API, o botão não existe — em vez de existir e falhar no clique. */}
        {!isFormOpen && (
          <button
            className="min-h-9 rounded bg-blue-600 px-3 text-sm font-semibold text-white"
            onClick={() => {
              setCreatedName(undefined)
              setIsFormOpen(true)
            }}
            type="button"
          >
            {labels.teamNewMember}
          </button>
        )}
      </header>

      {createdName && (
        <p className="rounded bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" role="status">
          {labels.teamCreatedMessage}: {createdName}
        </p>
      )}

      {team.error && (
        <p className="rounded bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200" role="alert">
          {team.error}
        </p>
      )}

      {isFormOpen && (
        <TeamMemberForm
          labels={labels}
          onCancel={() => setIsFormOpen(false)}
          onSubmit={(input) => void handleCreate(input)}
          saving={team.saving}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          aria-label={labels.teamSearch}
          className="min-h-9 min-w-56 flex-1 rounded border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
          onChange={(event) => team.setSearch(event.target.value)}
          placeholder={labels.teamSearch}
          type="search"
          value={team.search}
        />

        {/* So aparece quando ha o que limpar (web.md §7). */}
        {team.hasFilters && (
          <button className="text-sm text-blue-700 underline dark:text-blue-300" onClick={team.clearFilters} type="button">
            {labels.teamClearFilters}
          </button>
        )}
      </div>

      {/*
        A barra de acao em lote so existe com algo marcado. Um controle permanente e desabilitado
        ocupa espaco em toda visita para servir a minoria das visitas.
      */}
      {team.canDeactivate && team.selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded bg-gray-50 px-4 py-3 dark:bg-gray-800">
          <span className="text-sm text-gray-700 dark:text-gray-200">
            {labels.teamSelectedCount.replace('{count}', String(team.selected.size))}
          </span>
          <button
            className="min-h-9 rounded border border-gray-300 px-3 text-sm disabled:opacity-60 dark:border-gray-600"
            disabled={team.saving}
            onClick={() => void team.setSelectedActive(true)}
            type="button"
          >
            {labels.teamBulkActivate}
          </button>
          <button
            className="min-h-9 rounded border border-red-300 px-3 text-sm text-red-700 disabled:opacity-60 dark:border-red-800 dark:text-red-300"
            disabled={team.saving}
            onClick={() => void team.setSelectedActive(false)}
            type="button"
          >
            {labels.teamBulkDeactivate}
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {team.canDeactivate && (
                <th className="px-4 py-3">
                  <input
                    aria-label={labels.teamSelectAll}
                    checked={team.allVisibleSelected}
                    className="size-4"
                    onChange={team.toggleAllVisible}
                    type="checkbox"
                  />
                </th>
              )}
              <th className="px-4 py-3">{labels.name}</th>
              <th className="px-4 py-3">{labels.email}</th>
              <th className="px-4 py-3">{labels.teamRole}</th>
              <th className="px-4 py-3">{labels.teamStatus}</th>
              {team.canDeactivate && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {team.members.map((member) => (
              <tr className="border-t border-gray-100 dark:border-gray-800" key={member.id}>
                {team.canDeactivate && (
                  <td className={CELL}>
                    <input
                      aria-label={`${labels.teamSelectRow} ${member.name}`}
                      checked={team.selected.has(member.id)}
                      className="size-4"
                      onChange={() => team.toggleSelected(member.id)}
                      type="checkbox"
                    />
                  </td>
                )}
                <td className={CELL}>{member.name}</td>
                <td className={CELL}>{member.email}</td>
                <td className={CELL}>{member.role === 'admin' ? labels.teamRoleAdmin : labels.teamRoleMember}</td>
                <td className={CELL}>{member.isActive ? labels.teamActive : labels.teamInactive}</td>
                {team.canDeactivate && (
                  <td className={CELL}>
                    <button
                      className="text-sm text-blue-700 disabled:opacity-60 dark:text-blue-300"
                      disabled={team.saving}
                      onClick={() => void team.setMemberActive(member.id, !member.isActive)}
                      type="button"
                    >
                      {member.isActive ? labels.teamDeactivate : labels.teamActivate}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {team.loading && <p className="px-4 py-8 text-center text-sm text-gray-500">{labels.teamLoading}</p>}
        {/* "Nada cadastrado" e "nada encontrado" pedem coisas diferentes: criar, ou afrouxar a busca. */}
        {!team.loading && team.members.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-gray-500">
            {team.hasFilters ? labels.teamNoResults : labels.teamEmpty}
          </p>
        )}
      </div>

      {/* A paginação só aparece quando há mais de uma página: um controle inerte é ruído. */}
      {lastPage > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label={labels.teamTitle}>
          <button
            className="min-h-9 rounded border border-gray-300 px-3 text-sm disabled:opacity-50 dark:border-gray-700"
            disabled={team.page <= 1 || team.loading}
            onClick={() => team.goToPage(team.page - 1)}
            type="button"
          >
            {labels.teamPrevious}
          </button>

          <span className="text-sm text-gray-500 dark:text-gray-400">
            {labels.teamPageOf.replace('{current}', String(team.page)).replace('{last}', String(lastPage))}
          </span>

          <button
            className="min-h-9 rounded border border-gray-300 px-3 text-sm disabled:opacity-50 dark:border-gray-700"
            disabled={team.page >= lastPage || team.loading}
            onClick={() => team.goToPage(team.page + 1)}
            type="button"
          >
            {labels.teamNext}
          </button>
        </nav>
      )}
    </div>
  )
}
