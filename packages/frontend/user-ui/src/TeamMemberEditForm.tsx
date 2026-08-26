/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Editar e-mail, nome e papel de quem já existe.
 *
 * Sem senha: quem troca é o dono dela, pelo fluxo de redefinição — um administrador digitando a
 * senha de outra pessoa é a prática que o fluxo de redefinição existe para substituir.
 */

import { Check } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import type { UpdateTeamMemberInput, UserProfile } from './providers/types'
import { DEFAULT_USER_LABELS, type UserLabels } from './workspace/labels'

export type TeamMemberEditFormProps = {
  readonly member: UserProfile
  readonly labels?: Partial<UserLabels>
  readonly saving: boolean
  /**
   * Mensagem a ancorar NO campo de e-mail, quando o servidor recusa por duplicidade.
   *
   * Ancorada, e não num aviso solto no rodapé: quem preencheu precisa ver qual campo recusou, e
   * numa ficha com vários campos um aviso genérico vira caça ao erro.
   */
  readonly emailError?: string
  readonly onSubmit: (input: UpdateTeamMemberInput) => void
  readonly onCancel: () => void
}

const FIELD =
  'h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none' +
  ' focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20' +
  ' dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
const SELECT_FIELD = `${FIELD} cursor-pointer appearance-none pr-9`
const LABEL = 'mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100'

export function TeamMemberEditForm({
  member,
  labels: overrides,
  saving,
  emailError,
  onSubmit,
  onCancel,
}: TeamMemberEditFormProps) {
  const labels = { ...DEFAULT_USER_LABELS, ...overrides }
  const [email, setEmail] = useState(member.email)
  const [name, setName] = useState(member.name)
  const [role, setRole] = useState(member.role)

  const unchanged = name.trim() === member.name && role === member.role && email.trim() === member.email

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    onSubmit({ name: name.trim(), role, email: email.trim() })
  }

  return (
    <form
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
      onSubmit={handleSubmit}
    >
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {labels.teamEditTitle} {member.email}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="team-edit-email">
            {labels.email}
          </label>
          <input
            aria-describedby={emailError ? 'team-edit-email-error' : undefined}
            aria-invalid={emailError ? true : undefined}
            autoComplete="email"
            className={emailError ? `${FIELD} border-red-500 dark:border-red-500` : FIELD}
            id="team-edit-email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          {emailError && (
            <p className="mt-1 text-xs text-red-700 dark:text-red-300" id="team-edit-email-error">
              {emailError}
            </p>
          )}
        </div>

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
          className="inline-flex min-h-10 items-center gap-2 rounded bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving || unchanged}
          type="submit"
        >
          <Check aria-hidden="true" className="size-4" />
          {saving ? labels.teamSaving : labels.teamSave}
        </button>
        <button className="text-sm text-gray-600 dark:text-gray-300" onClick={onCancel} type="button">
          {labels.teamCancel}
        </button>
      </div>
    </form>
  )
}
