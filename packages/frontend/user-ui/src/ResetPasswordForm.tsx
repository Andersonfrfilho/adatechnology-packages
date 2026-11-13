/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useCallback, useState, type FormEvent } from 'react'

import { DEFAULT_USER_LABELS, type UserLabels } from './workspace/labels'

const INPUT_CLASS =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

export type ResetPasswordFormProps = {
  readonly onSubmit: (newPassword: string) => Promise<void>
  readonly loading?: boolean
  readonly error?: string
  readonly labels?: Partial<UserLabels>
}

export function ResetPasswordForm({ onSubmit, loading = false, error, labels: overrides }: ResetPasswordFormProps) {
  const labels = { ...DEFAULT_USER_LABELS, ...overrides }
  const [newPassword, setNewPassword] = useState('')

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      await onSubmit(newPassword)
    },
    [newPassword, onSubmit],
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={LABEL_CLASS} htmlFor="user-ui-reset-password-new-password">
          {labels.newPassword}
        </label>
        <input
          id="user-ui-reset-password-new-password"
          type="password"
          className={INPUT_CLASS}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          required
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-60"
      >
        {labels.resetPasswordSubmit}
      </button>
    </form>
  )
}
