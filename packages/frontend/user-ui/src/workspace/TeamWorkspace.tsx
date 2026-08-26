/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A tela COMPOSTA de equipe (`pluggable-module.md` §4): listagem paginada, cadastro e ativação.
 *
 * Ela some inteira quando a `UserApi` não traz `listTeam`. Capacidade por ausência, e não uma flag:
 * quem não expõe as rotas de admin do `user-module` não precisa dizer duas vezes.
 */

import { useState, type ReactNode } from 'react'

import { Avatar } from '../Avatar'
import type { UserProfile } from '../providers/types'
import { TeamMemberForm } from '../TeamMemberForm'
import { useTeam, TEAM_SORT_FIELDS, type TeamApi, type TeamSortField } from '../useTeam'
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
        A barra fica visivel desde o primeiro carregamento, com os botoes desligados ate haver
        selecao.
        Ela ja foi condicionada a `selected.size > 0` para poupar espaco — e o resultado foi que
        ninguem descobria que a acao em lote existia: para ver o controle era preciso adivinhar que
        marcar uma linha revelaria algo. Espaco em branco custa menos que uma funcao invisivel.
      */}
      {team.canDeactivate && team.members.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded bg-gray-50 px-4 py-3 dark:bg-gray-800">
          <span className="text-sm text-gray-700 dark:text-gray-200">
            {team.selected.size === 0
              ? labels.teamBulkHint
              : labels.teamSelectedCount.replace('{count}', String(team.selected.size))}
          </span>
          <button
            className="min-h-9 rounded border border-gray-300 px-3 text-sm disabled:opacity-60 dark:border-gray-600"
            disabled={team.saving || team.selected.size === 0}
            onClick={() => void team.setSelectedActive(true)}
            type="button"
          >
            {labels.teamBulkActivate}
          </button>
          <button
            className="min-h-9 rounded border border-red-300 px-3 text-sm text-red-700 disabled:opacity-60 dark:border-red-800 dark:text-red-300"
            disabled={team.saving || team.selected.size === 0}
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
              {/* Sem rotulo visivel: a coluna e de 36px e o titulo dobraria a largura dela. */}
              <th className="px-4 py-3"><span className="sr-only">{labels.teamPhoto}</span></th>
              <SortableHeader field={TEAM_SORT_FIELDS.NAME} label={labels.name} team={team} title={labels.teamSortBy} />
              <SortableHeader field={TEAM_SORT_FIELDS.EMAIL} label={labels.email} team={team} title={labels.teamSortBy} />
              <SortableHeader field={TEAM_SORT_FIELDS.ROLE} label={labels.teamRole} team={team} title={labels.teamSortBy} />
              <SortableHeader field={TEAM_SORT_FIELDS.ACTIVE} label={labels.teamStatus} team={team} title={labels.teamSortBy} />
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
                <td className={CELL}>
                  <AvatarCell
                    busy={team.saving}
                    canChange={team.canChangeAvatar}
                    label={`${labels.teamChangePhoto} ${member.name}`}
                    member={member}
                    onPick={(file) => void team.setMemberAvatar(member.id, file)}
                  />
                </td>
                <td className={CELL}>{member.name}</td>
                <td className={CELL}>{member.email}</td>
                <td className={CELL}>{member.role === 'admin' ? labels.teamRoleAdmin : labels.teamRoleMember}</td>
                <td className={CELL}>{member.isActive ? labels.teamActive : labels.teamInactive}</td>
                {team.canDeactivate && (
                  <td className={CELL}>
                    <div className="flex items-center gap-3">
                    <ActiveSwitch
                      busy={team.saving}
                      label={`${member.isActive ? labels.teamDeactivate : labels.teamActivate} ${member.name}`}
                      onToggle={() => void team.setMemberActive(member.id, !member.isActive)}
                      value={member.isActive}
                    />
                    {team.canSendPasswordReset &&
                      (team.passwordResetSentTo === member.id ? (
                        <span className="text-xs text-emerald-700 dark:text-emerald-300" role="status">
                          {labels.teamPasswordResetSent}
                        </span>
                      ) : (
                        <button
                          className="text-xs text-blue-700 underline disabled:opacity-60 dark:text-blue-300"
                          disabled={team.saving}
                          onClick={() => void team.sendPasswordReset(member.id)}
                          type="button"
                        >
                          {labels.teamSendPasswordReset}
                        </button>
                      ))}
                    </div>
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

type SortableHeaderProps = {
  readonly field: TeamSortField
  readonly label: string
  readonly title: string
  readonly team: ReturnType<typeof useTeam>
}

/**
 * `aria-sort` vai no `th`, nao no botao: e o `th` que o leitor de tela anuncia ao entrar na coluna,
 * e e la que a especificacao manda o estado morar.
 */
function SortableHeader({ field, label, title, team }: SortableHeaderProps) {
  const active = team.sort?.field === field ? team.sort.direction : undefined

  return (
    <th aria-sort={active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none'} className="px-4 py-3">
      <button
        className="flex items-center gap-1 uppercase tracking-wide hover:text-gray-900 dark:hover:text-gray-100"
        onClick={() => team.toggleSort(field)}
        title={`${title}: ${label}`}
        type="button"
      >
        {label}
        {/*
          A seta so aparece na coluna ativa. Um indicador neutro em toda coluna faria as quatro
          parecerem ordenadas ao mesmo tempo, que e o oposto do que ele existe para dizer.
        */}
        {active && <span aria-hidden="true">{active === 'asc' ? '\u2191' : '\u2193'}</span>}
      </button>
    </th>
  )
}

type ActiveSwitchProps = {
  readonly value: boolean
  readonly busy: boolean
  readonly label: string
  readonly onToggle: () => void
}

/**
 * `role="switch"` e nao um checkbox: o checkbox diz "selecionado para algo depois", e este controle
 * grava na hora. Confundir os dois na mesma linha — onde ja ha um checkbox de selecao — e o erro
 * que esta distincao evita.
 */
function ActiveSwitch({ value, busy, label, onToggle }: ActiveSwitchProps) {
  return (
    <button
      aria-checked={value}
      aria-label={label}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
        value ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
      }`}
      disabled={busy}
      onClick={onToggle}
      role="switch"
      type="button"
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${value ? 'left-5.5' : 'left-0.5'}`}
      />
    </button>
  )
}

type AvatarCellProps = {
  readonly member: UserProfile
  readonly canChange: boolean
  readonly busy: boolean
  readonly label: string
  readonly onPick: (file: File) => void
}

/**
 * O `<input type="file">` fica escondido dentro do `<label>`, e a foto é o alvo do clique.
 *
 * O botão nativo de arquivo não aceita ser estilizado de forma consistente entre navegadores, e um
 * botão "Escolher arquivo" ao lado de cada linha encheria a tabela. Clicar na própria foto é o
 * gesto que a pessoa já espera.
 */
function AvatarCell({ member, canChange, busy, label, onPick }: AvatarCellProps) {
  const avatar = <Avatar name={member.name} {...(member.avatarUrl ? { url: member.avatarUrl } : {})} />

  if (!canChange) return avatar

  return (
    <label
      className={`group relative inline-flex cursor-pointer rounded-full ${busy ? 'pointer-events-none opacity-60' : ''}`}
      title={label}
    >
      {avatar}
      <span className="absolute inset-0 hidden items-center justify-center rounded-full bg-black/50 text-white group-hover:flex group-focus-within:flex">
        <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </span>
      <input
        accept="image/jpeg,image/png,image/webp"
        aria-label={label}
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Limpa o valor para escolher o MESMO arquivo de novo disparar `change` outra vez —
          // necessário quando a primeira tentativa falhou e a pessoa quer repetir.
          event.target.value = ''
          if (file) onPick(file)
        }}
        type="file"
      />
    </label>
  )
}
