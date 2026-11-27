/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useState, type FormEvent } from 'react'

import type { ChangeEmailParams } from '../providers/types'
import { DEFAULT_ACCOUNT_CONTROLS, type AccountControls } from './accountControls'
import { DEFAULT_ACCOUNT_LABELS, type AccountLabels } from './accountLabels'
import { useAccountAction } from './useAccountAction'

export type ChangeEmailFormProps = {
  readonly onSubmit: (params: ChangeEmailParams) => Promise<void>
  readonly labels?: Partial<AccountLabels>
  readonly controls?: AccountControls
}

export function ChangeEmailForm({ onSubmit, labels: overrides, controls = DEFAULT_ACCOUNT_CONTROLS }: ChangeEmailFormProps) {
  const labels = { ...DEFAULT_ACCOUNT_LABELS, ...overrides }
  const { Field, Button } = controls
  const action = useAccountAction()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    void action.run(async () => {
      await onSubmit({ currentPassword, newEmail })
      setCurrentPassword('')
    })
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <Field autoComplete="email" id="account-new-email" inputMode="email" label={labels.newEmail} onChange={setNewEmail} type="email" value={newEmail} />
      <Field autoComplete="current-password" id="account-email-password" label={labels.currentPassword} onChange={setCurrentPassword} type="password" value={currentPassword} {...(action.error ? { error: action.error } : {})} />
      {action.isDone ? <p className="text-sm text-green-700 dark:text-green-300" role="status">{labels.changeEmailSent}</p> : null}
      <Button isDisabled={action.isRunning || !currentPassword || !newEmail} type="submit">{labels.changeEmailSubmit}</Button>
    </form>
  )
}
