/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O administrador define a senha de outra pessoa. Existe ao lado do envio da redefinição por e-mail
 * para quem não tem e-mail configurado (ou precisa liberar o acesso na hora); só aparece quando a
 * `UserApi` traz `setTeamMemberPassword`.
 */

import { Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import type { UserProfile } from './providers/types'
import { TEAM_PASSWORD_MIN_LENGTH } from './TeamMemberForm'
import { DEFAULT_USER_LABELS, type UserLabels } from './workspace/labels'

export type TeamMemberPasswordFormProps = {
  readonly member: UserProfile
  readonly labels?: Partial<UserLabels>
  readonly saving: boolean
  /** Mensagem a ancorar no campo quando o servidor recusa a senha. */
  readonly error?: string
  readonly onSubmit: (password: string) => void
  readonly onCancel: () => void
}

const FIELD =
  'h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none' +
  ' focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20' +
  ' dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
const LABEL = 'mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100'

export function TeamMemberPasswordForm({
  member,
  labels: overrides,
  saving,
  error,
  onSubmit,
  onCancel,
}: TeamMemberPasswordFormProps) {
  const labels = { ...DEFAULT_USER_LABELS, ...overrides }
  const [password, setPassword] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    onSubmit(password)
  }

  return (
    <form
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
      onSubmit={handleSubmit}
    >
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {labels.teamSetPasswordTitle} {member.email}
      </p>

      <div>
        <label className={LABEL} htmlFor="team-set-password">
          {labels.teamNewPassword}
        </label>
        {/* `new-password`: com `off` o gerenciador ofereceria a senha de quem está logado. */}
        <input
          aria-describedby="team-set-password-hint"
          aria-invalid={error ? true : undefined}
          autoComplete="new-password"
          className={error ? `${FIELD} border-red-500 dark:border-red-500` : FIELD}
          id="team-set-password"
          minLength={TEAM_PASSWORD_MIN_LENGTH}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400" id="team-set-password-hint">
          {labels.teamNewPasswordHint}
        </p>
        {error && (
          <p className="mt-1 text-xs text-red-700 dark:text-red-300" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving || password.length < TEAM_PASSWORD_MIN_LENGTH}
          type="submit"
        >
          <Lock aria-hidden="true" className="size-4" />
          {labels.teamSetPasswordSubmit}
        </button>
        <button className="text-sm text-gray-600 dark:text-gray-300" onClick={onCancel} type="button">
          {labels.teamCancel}
        </button>
      </div>
    </form>
  )
}
