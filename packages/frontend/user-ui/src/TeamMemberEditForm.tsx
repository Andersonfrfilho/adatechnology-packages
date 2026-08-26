/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Editar nome e papel de quem já existe.
 *
 * Sem e-mail e sem senha, de propósito. O e-mail é a identidade de login e aparece em trilha de
 * auditoria — trocá-lo por um campo de formulário faria o histórico apontar para outra pessoa. Senha
 * quem troca é o dono dela, pelo fluxo de redefinição.
 */

import { useState, type FormEvent } from 'react'

import type { UpdateTeamMemberInput, UserProfile } from './providers/types'
import { DEFAULT_USER_LABELS, type UserLabels } from './workspace/labels'

export type TeamMemberEditFormProps = {
  readonly member: UserProfile
  readonly labels?: Partial<UserLabels>
  readonly saving: boolean
  readonly onSubmit: (input: UpdateTeamMemberInput) => void
  readonly onCancel: () => void
}

const FIELD =
  'h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none' +
  ' focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20' +
  ' dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
const SELECT_FIELD = `${FIELD} cursor-pointer appearance-none pr-9`
const LABEL = 'mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100'

export function TeamMemberEditForm({ member, labels: overrides, saving, onSubmit, onCancel }: TeamMemberEditFormProps) {
  const labels = { ...DEFAULT_USER_LABELS, ...overrides }
  const [name, setName] = useState(member.name)
  const [role, setRole] = useState(member.role)

  const unchanged = name.trim() === member.name && role === member.role

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    onSubmit({ name: name.trim(), role })
  }

  return (
    <form className="space-y-4 rounded border border-gray-200 p-4 dark:border-gray-700" onSubmit={handleSubmit}>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {labels.teamEditTitle} {member.email}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="team-edit-name">
            {labels.name}
          </label>
          <input
            autoComplete="name"
            className={FIELD}
            id="team-edit-name"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="team-edit-role">
            {labels.teamRole}
          </label>
          <div className="relative">
            <select
              className={SELECT_FIELD}
              id="team-edit-role"
              onChange={(event) => setRole(event.target.value)}
              value={role}
            >
              <option value="member">{labels.teamRoleMember}</option>
              <option value="admin">{labels.teamRoleAdmin}</option>
            </select>
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Salvar sem mudar nada gravaria uma linha de auditoria dizendo que algo mudou. */}
        <button
          className="min-h-10 rounded bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving || unchanged}
          type="submit"
        >
          {saving ? labels.teamSaving : labels.teamSave}
        </button>
        <button className="text-sm text-gray-600 dark:text-gray-300" onClick={onCancel} type="button">
          {labels.teamCancel}
        </button>
      </div>
    </form>
  )
}
