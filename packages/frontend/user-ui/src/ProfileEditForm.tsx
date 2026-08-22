/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useCallback, useState, type FormEvent } from 'react'

import { DEFAULT_USER_LABELS, type UserLabels } from './workspace/labels'
import type { UpdateProfileInput, UserProfile } from './providers/types'

const INPUT_CLASS =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const DISABLED_INPUT_CLASS = `${INPUT_CLASS} opacity-60 cursor-not-allowed`
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

export type ProfileEditFormProps = {
  readonly profile: UserProfile
  readonly onSubmit: (input: UpdateProfileInput) => Promise<void>
  readonly loading?: boolean
  readonly error?: string
  readonly labels?: Partial<UserLabels>
}

export function ProfileEditForm({ profile, onSubmit, loading = false, error, labels: overrides }: ProfileEditFormProps) {
  const labels = { ...DEFAULT_USER_LABELS, ...overrides }
  const [name, setName] = useState(profile.name)

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      await onSubmit({ name: name.trim() })
    },
    [name, onSubmit],
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={LABEL_CLASS} htmlFor="user-ui-profile-name">
          {labels.name}
        </label>
        <input
          id="user-ui-profile-name"
          type="text"
          className={INPUT_CLASS}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          required
        />
      </div>
      <div>
        <label className={LABEL_CLASS} htmlFor="user-ui-profile-email">
          {labels.email}
        </label>
        <input id="user-ui-profile-email" type="email" className={DISABLED_INPUT_CLASS} value={profile.email} disabled readOnly />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-60"
      >
        {labels.profileSave}
      </button>
    </form>
  )
}
