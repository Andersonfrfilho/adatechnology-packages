/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Troca de senha com a senha atual (o `ChangePasswordForm` antigo só pede o link por e-mail).
 */

import { useState, type FormEvent } from 'react'

import type { ChangePasswordParams } from '../providers/types'
import { DEFAULT_ACCOUNT_CONTROLS, type AccountControls } from './accountControls'
import { DEFAULT_ACCOUNT_LABELS, type AccountLabels } from './accountLabels'
import { useAccountAction } from './useAccountAction'

export type ChangePasswordWithCurrentFormProps = {
  readonly onSubmit: (params: ChangePasswordParams) => Promise<void>
  readonly labels?: Partial<AccountLabels>
  readonly controls?: AccountControls
}

export function ChangePasswordWithCurrentForm({ onSubmit, labels: overrides, controls = DEFAULT_ACCOUNT_CONTROLS }: ChangePasswordWithCurrentFormProps) {
  const labels = { ...DEFAULT_ACCOUNT_LABELS, ...overrides }
  const { Field, Button } = controls
  const action = useAccountAction()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [repeated, setRepeated] = useState('')
  const mismatch = repeated.length > 0 && repeated !== newPassword

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (mismatch) return
    void action.run(async () => {
      await onSubmit({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setRepeated('')
    })
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <Field autoComplete="current-password" id="account-current-password" label={labels.currentPassword} onChange={setCurrentPassword} type="password" value={currentPassword} {...(action.error ? { error: action.error } : {})} />
      <Field autoComplete="new-password" id="account-new-password" label={labels.newPassword} onChange={setNewPassword} type="password" value={newPassword} />
      <Field autoComplete="new-password" id="account-repeat-password" label={labels.confirmNewPassword} onChange={setRepeated} type="password" value={repeated} {...(mismatch ? { error: labels.passwordsDoNotMatch } : {})} />
      {action.isDone ? <p className="text-sm text-green-700 dark:text-green-300" role="status">{labels.changePasswordDone}</p> : null}
      <Button isDisabled={action.isRunning || !currentPassword || !newPassword || mismatch} type="submit">{labels.changePasswordSubmit}</Button>
    </form>
  )
}
