/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useCallback, useState, type FormEvent } from 'react'

import { DEFAULT_USER_LABELS, type UserLabels } from './workspace/labels'
import type { SignInParams } from './providers/types'

const INPUT_CLASS =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

export type SignInFormProps = {
  readonly onSubmit: (params: SignInParams) => Promise<void>
  readonly onForgotPassword?: () => void
  readonly loading?: boolean
  readonly error?: string
  readonly labels?: Partial<UserLabels>
}

export function SignInForm({ onSubmit, onForgotPassword, loading = false, error, labels: overrides }: SignInFormProps) {
  const labels = { ...DEFAULT_USER_LABELS, ...overrides }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      await onSubmit({ email: email.trim(), password })
    },
    [email, password, onSubmit],
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={LABEL_CLASS} htmlFor="user-ui-sign-in-email">
          {labels.email}
        </label>
        <input
          id="user-ui-sign-in-email"
          type="email"
          className={INPUT_CLASS}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </div>
      <div>
        <label className={LABEL_CLASS} htmlFor="user-ui-sign-in-password">
          {labels.password}
        </label>
        <input
          id="user-ui-sign-in-password"
          type="password"
          className={INPUT_CLASS}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {/* 44px de altura (py-2 + line-height + borda) — área de toque mínima recomendada em mobile */}
      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-60"
      >
        {labels.signInSubmit}
      </button>
      {onForgotPassword ? (
        <button type="button" onClick={onForgotPassword} className="text-sm text-brand-600 dark:text-brand-400 underline">
          {labels.forgotPasswordLink}
        </button>
      ) : null}
    </form>
  )
}
