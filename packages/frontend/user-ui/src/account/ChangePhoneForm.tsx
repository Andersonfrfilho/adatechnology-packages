/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useState, type FormEvent } from 'react'

import type { ChangePhoneParams } from '../providers/types'
import { DEFAULT_ACCOUNT_CONTROLS, type AccountControls } from './accountControls'
import { DEFAULT_ACCOUNT_LABELS, type AccountLabels } from './accountLabels'
import { useAccountAction } from './useAccountAction'

export type ChangePhoneFormProps = {
  readonly onSubmit: (params: ChangePhoneParams) => Promise<void>
  /** Mensagem do servidor por campo (409 de telefone repetido chega como `phone`). */
  readonly labels?: Partial<AccountLabels>
  readonly controls?: AccountControls
}

export function ChangePhoneForm({ onSubmit, labels: overrides, controls = DEFAULT_ACCOUNT_CONTROLS }: ChangePhoneFormProps) {
  const labels = { ...DEFAULT_ACCOUNT_LABELS, ...overrides }
  const { Field, Button } = controls
  const action = useAccountAction()
  const [currentPassword, setCurrentPassword] = useState('')
  const [phone, setPhone] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    void action.run(async () => {
      await onSubmit({ currentPassword, phone })
      setCurrentPassword('')
      setPhone('')
    })
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <Field autoComplete="tel" id="account-new-phone" inputMode="tel" label={labels.phone} onChange={setPhone} type="tel" value={phone} />
      <Field autoComplete="current-password" id="account-phone-password" label={labels.currentPassword} onChange={setCurrentPassword} type="password" value={currentPassword} {...(action.error ? { error: action.error } : {})} />
      <Button isDisabled={action.isRunning || !currentPassword || !phone} type="submit">{labels.changePhoneSubmit}</Button>
    </form>
  )
}
