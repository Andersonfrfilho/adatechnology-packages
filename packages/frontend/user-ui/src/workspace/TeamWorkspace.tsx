/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A tela COMPOSTA de equipe (`pluggable-module.md` §4): listagem paginada, cadastro e ativação.
 *
 * Ela some inteira quando a `UserApi` não traz `listTeam`. Capacidade por ausência, e não uma flag:
 * quem não expõe as rotas de admin do `user-module` não precisa dizer duas vezes.
 */

import { useState, type ReactNode } from 'react'

import { KeyRound, Pencil, Plus, Trash2, UserPlus, X, type LucideIcon } from 'lucide-react'

import type { BackgroundRemovalConfig } from '@adatechnology/image-cutout'

import { Avatar } from '../Avatar'
import { AvatarPicker } from '../AvatarPicker'
import type { UserProfile } from '../providers/types'
import { TeamMemberEditForm } from '../TeamMemberEditForm'
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
  /**
   * Liga o recorte de fundo na troca de foto. Ausente, a foto sobe como veio.
   *
   * O modelo e o runtime sao servidos pelo host, e nao pelo pacote: sao megabytes que nao cabem no
   * `npm install` de quem nem usa o recurso, e servir do proprio dominio mantem a foto e o CSP
   * dentro de casa.
   */
  readonly backgroundRemoval?: BackgroundRemovalConfig
}

/**
 * O codigo que o host devolve quando o e-mail ja pertence a outra conta.
 *
 * Fixo aqui porque e o contrato do `user-module` (`USER_EMAIL_ALREADY_EXISTS`); um host com
 * vocabulario proprio traduz no adaptador dele, que e onde o erro nasce.
 */
const EMAIL_TAKEN_CODE = 'USER_EMAIL_ALREADY_EXISTS'

const CELL = 'px-4 py-3 align-middle text-sm text-gray-900 dark:text-gray-100'

export function TeamWorkspace({ labels: overrides, header, pageSize, api, backgroundRemoval }: TeamWorkspaceProps) {
  const labels = { ...DEFAULT_USER_LABELS, ...overrides }
  const team = useTeam({ ...(pageSize === undefined ? {} : { pageSize }), ...(api ? { api } : {}) })
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [createdName, setCreatedName] = useState<string>()
  /** A foto escolhida numa linha, esperando revisao. O painel abre com largura inteira, acima. */
  const [pendingAvatar, setPendingAvatar] = useState<{ member: UserProfile; file: File }>()
  const [editing, setEditing] = useState<UserProfile>()

  if (!team.enabled) return null

  /** A coluna de acoes existe se HOUVER acao — nao so quando ha desativacao. */
  const hasRowActions = team.canDeactivate || team.canEdit || team.canSendPasswordReset

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
          <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{labels.teamTitle}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{labels.teamSubtitle}</p>
        </div>

        {/* Sem `createTeamMember` na API, o botão não existe — em vez de existir e falhar no clique. */}
        {!isFormOpen && (
          <button
            className="inline-flex min-h-9 items-center gap-2 rounded bg-blue-600 px-3 text-sm font-semibold text-white"
            onClick={() => {
              setCreatedName(undefined)
              setIsFormOpen(true)
            }}
            type="button"
          >
            {/* Decorativo: o rotulo ao lado ja diz a acao, e anunciar duas vezes atrapalha. */}
            <UserPlus aria-hidden="true" className="size-4" />
            {labels.teamNewMember}
          </button>
        )}
      </header>

      {createdName && (
        <p
          className="rounded bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          role="status"
        >
          {labels.teamCreatedMessage}: {createdName}
        </p>
      )}

      {team.error && (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          role="alert"
        >
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

      {editing && (
        <TeamMemberEditForm
          labels={labels}
          member={editing}
          onCancel={() => setEditing(undefined)}
          onSubmit={(input) => {
            void team.updateMember(editing.id, input).then((saved) => {
              if (saved) setEditing(undefined)
            })
          }}
          saving={team.saving}
          {...(team.errorCode === EMAIL_TAKEN_CODE ? { emailError: labels.teamEmailTaken } : {})}
        />
      )}

      {pendingAvatar && (
        <AvatarPicker
          busy={team.saving}
          file={pendingAvatar.file}
          labels={labels}
          onCancel={() => setPendingAvatar(undefined)}
          onConfirm={(file) => {
            void team.setMemberAvatar(pendingAvatar.member.id, file)
            setPendingAvatar(undefined)
          }}
          title={`${labels.teamChangePhoto} ${pendingAvatar.member.name}`}
          {...(backgroundRemoval ? { backgroundRemoval } : {})}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          aria-label={labels.teamSearch}
          className="min-h-9 min-w-56 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-gray-700 dark:bg-gray-900"
          onChange={(event) => team.setSearch(event.target.value)}
          placeholder={labels.teamSearch}
          type="search"
          value={team.search}
        />

        {/* So aparece quando ha o que limpar (web.md §7). */}
        {team.hasFilters && (
          <button
            className="inline-flex items-center gap-1 text-sm text-blue-700 underline dark:text-blue-300"
            onClick={team.clearFilters}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
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
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <span className="text-sm text-gray-700 dark:text-gray-200">
            {team.selected.size === 0
              ? labels.teamBulkHint
              : labels.teamSelectedCount.replace('{count}', String(team.selected.size))}
          </span>
          <button
            className="inline-flex min-h-9 items-center gap-2 rounded border border-gray-300 px-3 text-sm disabled:opacity-60 dark:border-gray-600"
            disabled={team.saving || team.selected.size === 0}
            onClick={() => void team.setSelectedActive(true)}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            {labels.teamBulkActivate}
          </button>
          {/* Destrutiva leva icone por regra: ele reforca o peso da acao antes do clique. */}
          <button
            className="inline-flex min-h-9 items-center gap-2 rounded border border-red-300 px-3 text-sm text-red-700 disabled:opacity-60 dark:border-red-800 dark:text-red-300"
            disabled={team.saving || team.selected.size === 0}
            onClick={() => void team.setSelectedActive(false)}
            type="button"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            {labels.teamBulkDeactivate}
          </button>
        </div>
      )}

      {/*
        A tabela pinta a PROPRIA superficie, e nao herda a do host.

        A zebra nasceu invisivel exatamente por isso: as listras eram `gray-50` e o painel que
        consome esta tela tambem e `gray-50`, entao linha listrada e fundo da pagina davam na mesma
        cor. Componente de pacote nao sabe em que fundo vai cair — se ele quer contraste, ele
        estabelece a base.
      */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
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
              <th className="px-4 py-3">
                <span className="sr-only">{labels.teamPhoto}</span>
              </th>
              <SortableHeader field={TEAM_SORT_FIELDS.NAME} label={labels.name} team={team} title={labels.teamSortBy} />
              <SortableHeader
                field={TEAM_SORT_FIELDS.EMAIL}
                label={labels.email}
                team={team}
                title={labels.teamSortBy}
              />
              <SortableHeader
                field={TEAM_SORT_FIELDS.ROLE}
                label={labels.teamRole}
                team={team}
                title={labels.teamSortBy}
              />
              <SortableHeader
                field={TEAM_SORT_FIELDS.ACTIVE}
                label={labels.teamStatus}
                team={team}
                title={labels.teamSortBy}
              />
              {hasRowActions && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {team.members.map((member, index) => (
              /*
                Zebra por indice da linha renderizada, e nao por id: a listra tem que alternar do
                jeito que o olho percorre, e com ordenacao ou filtro a ordem dos ids nao e a ordem da
                tela.
              */
              <tr
                className={`border-b border-gray-100 transition-colors last:border-b-0 hover:bg-blue-50/60 dark:border-gray-800 dark:hover:bg-blue-950/30 ${
                  index % 2 === 1 ? 'bg-gray-50/80 dark:bg-gray-800/30' : 'bg-transparent'
                }`}
                key={member.id}
              >
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
                    onPick={(file) => setPendingAvatar({ member, file })}
                  />
                </td>
                <td className={`${CELL} font-medium`}>{member.name}</td>
                {/* O e-mail e dado de apoio: peso menor evita que ele dispute com o nome. */}
                <td className={`${CELL} text-gray-500 dark:text-gray-400`}>{member.email}</td>
                <td className={CELL}>
                  <Badge tone={member.role === 'admin' ? 'accent' : 'neutral'}>
                    {member.role === 'admin' ? labels.teamRoleAdmin : labels.teamRoleMember}
                  </Badge>
                </td>
                <td className={CELL}>
                  <Badge tone={member.isActive ? 'positive' : 'muted'}>
                    {member.isActive ? labels.teamActive : labels.teamInactive}
                  </Badge>
                </td>
                {hasRowActions && (
                  <td className={CELL}>
                    <div className="flex items-center gap-3">
                      {team.canDeactivate && (
                        <ActiveSwitch
                          busy={team.saving}
                          label={`${member.isActive ? labels.teamDeactivate : labels.teamActivate} ${member.name}`}
                          onToggle={() => void team.setMemberActive(member.id, !member.isActive)}
                          value={member.isActive}
                        />
                      )}
                      {team.canEdit && (
                        <RowAction
                          busy={team.saving}
                          icon={Pencil}
                          label={labels.teamEdit}
                          onClick={() => setEditing(member)}
                          srSuffix={member.name}
                        />
                      )}
                      {team.canSendPasswordReset &&
                        (team.passwordResetSentTo === member.id ? (
                          <span className="text-xs text-emerald-700 dark:text-emerald-300" role="status">
                            {labels.teamPasswordResetSent}
                          </span>
                        ) : (
                          <RowAction
                            busy={team.saving}
                            icon={KeyRound}
                            label={labels.teamSendPasswordReset}
                            onClick={() => void team.sendPasswordReset(member.id)}
                            srSuffix={member.name}
                          />
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
        <svg
          aria-hidden="true"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
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

type RowActionProps = {
  readonly icon: LucideIcon
  readonly label: string
  /** Nome da linha, para o leitor de tela saber de QUEM e a acao — a tabela repete o rotulo. */
  readonly srSuffix: string
  readonly busy: boolean
  readonly onClick: () => void
}

/**
 * Acao de linha: icone mais rotulo, e um botao de verdade.
 *
 * Era um `<button>` com cara de link sublinhado. Num grupo de acoes lado a lado o sublinhado nao
 * distingue nada — e o ganho do icone e maior justamente onde ha varios controles juntos, que e a
 * situacao desta celula.
 */
function RowAction({ icon: Icon, label, srSuffix, busy, onClick }: RowActionProps) {
  return (
    <button
      aria-label={`${label} ${srSuffix}`}
      className="inline-flex min-h-8 items-center gap-1.5 rounded border border-gray-300 px-2 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
      disabled={busy}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </button>
  )
}

const BADGE_TONE = {
  positive:
    'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-400/20',
  accent: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-400/20',
  neutral: 'bg-gray-100 text-gray-700 ring-gray-500/20 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-400/20',
  muted: 'bg-gray-100 text-gray-500 ring-gray-400/20 dark:bg-gray-800 dark:text-gray-500 dark:ring-gray-500/20',
} as const
type BadgeTone = keyof typeof BADGE_TONE

type BadgeProps = {
  readonly tone: BadgeTone
  readonly children: ReactNode
}

/**
 * Etiqueta para papel e situacao.
 *
 * Como texto solto os dois campos tinham o mesmo peso do nome e do e-mail, e a coluna inteira lia
 * como uma parede de cinza igual. A cor faz "Ativo" e "Inativo" se separarem numa varredura de
 * olho, que e o que se faz numa lista de pessoas — ninguem le linha por linha.
 *
 * `ring` em vez de `border`: a borda somaria um pixel a caixa e desalinharia a etiqueta com o texto
 * das celulas vizinhas.
 */
function Badge({ tone, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE_TONE[tone]}`}
    >
      {children}
    </span>
  )
}
