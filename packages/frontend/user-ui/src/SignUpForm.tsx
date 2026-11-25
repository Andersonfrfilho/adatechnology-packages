/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useCallback, useState, type FormEvent } from 'react'

import { DEFAULT_USER_LABELS, type UserLabels } from './workspace/labels'
import type { SignUpParams } from './providers/types'

const INPUT_CLASS =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

/** Acompanha o mínimo do servidor (`signUpSchema`). */
export const SIGN_UP_PASSWORD_MIN_LENGTH = 8

export type SignUpFormProps = {
  readonly onSubmit: (params: SignUpParams) => Promise<void>
  /** Ausente, o atalho para o login não é desenhado. */
  readonly onSignInInstead?: () => void
  readonly loading?: boolean
  readonly error?: string
  readonly labels?: Partial<UserLabels>
}

export function SignUpForm({ onSubmit, onSignInInstead, loading = false, error, labels: overrides }: SignUpFormProps) {
  const labels = { ...DEFAULT_USER_LABELS, ...overrides }
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      await onSubmit({ name: name.trim(), email: email.trim(), password })
    },
    [name, email, password, onSubmit],
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={LABEL_CLASS} htmlFor="user-ui-sign-up-name">
          {labels.name}
        </label>
        <input
          id="user-ui-sign-up-name"
          className={INPUT_CLASS}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          required
        />
      </div>
      <div>
        <label className={LABEL_CLASS} htmlFor="user-ui-sign-up-email">
          {labels.email}
        </label>
        <input
          id="user-ui-sign-up-email"
          type="email"
          className={INPUT_CLASS}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </div>
      <div>
        <label className={LABEL_CLASS} htmlFor="user-ui-sign-up-password">
          {labels.password}
        </label>
        <input
          id="user-ui-sign-up-password"
          type="password"
          className={INPUT_CLASS}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={SIGN_UP_PASSWORD_MIN_LENGTH}
          aria-describedby="user-ui-sign-up-password-hint"
          required
        />
        <p id="user-ui-sign-up-password-hint" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {labels.signUpPasswordHint}
        </p>
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
        {labels.signUpSubmit}
      </button>
      {onSignInInstead ? (
        <button type="button" onClick={onSignInInstead} className="text-sm text-brand-600 dark:text-brand-400 underline">
          {labels.signUpToSignIn}
        </button>
      ) : null}
    </form>
  )
}
