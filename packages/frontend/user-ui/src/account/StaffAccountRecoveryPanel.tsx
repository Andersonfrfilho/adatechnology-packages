/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Seção da ficha para a equipe: situação da conta do cliente (e-mail e telefone verificados, bloqueio, CPF
 * mascarado, códigos de reserva para conferir a identidade FORA do sistema) e as ações assistidas.
 * Não mostra dado que a equipe não precise; e-mail e telefone completos ficam fora do painel de recuperação.
 */

import { useState, type FormEvent } from 'react'

import type { RecoverAccountParams } from '../providers/types'
import { DEFAULT_ACCOUNT_CONTROLS, type AccountControls } from './accountControls'
import { DEFAULT_ACCOUNT_LABELS, type AccountLabels } from './accountLabels'
import { useAccountAction } from './useAccountAction'

export type StaffAccountSummary = {
  readonly isEmailVerified: boolean
  readonly isPhoneVerified: boolean
  readonly isLocked: boolean
  readonly maskedCpf?: string
  readonly reservationCodes: readonly string[]
}

export type StaffAccountRecoveryPanelProps = {
  readonly account: StaffAccountSummary
  readonly onRecover: (params: RecoverAccountParams) => Promise<void>
  readonly labels?: Partial<AccountLabels>
  readonly controls?: AccountControls
}

export function StaffAccountRecoveryPanel({ account, onRecover, labels: overrides, controls = DEFAULT_ACCOUNT_CONTROLS }: StaffAccountRecoveryPanelProps) {
  const labels = { ...DEFAULT_ACCOUNT_LABELS, ...overrides }
  const { Field, Button } = controls
  const action = useAccountAction()
  const [email, setEmail] = useState('')
  const [isIdentityConfirmed, setIsIdentityConfirmed] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    void action.run(async () => {
      await onRecover({ email })
      setEmail('')
      setIsIdentityConfirmed(false)
    })
  }

  return (
    <section aria-label={labels.recoveryTitle} className="space-y-3">
      <ul className="text-sm text-gray-700 dark:text-gray-300">
        <li>{account.isEmailVerified ? labels.emailVerified : labels.emailNotVerified}</li>
        <li>{account.isPhoneVerified ? labels.phoneVerified : labels.phoneNotVerified}</li>
        {account.maskedCpf ? <li>CPF {account.maskedCpf}</li> : null}
        {account.reservationCodes.length > 0 ? <li>{labels.recoveryReservations}: {account.reservationCodes.join(', ')}</li> : null}
        {account.isLocked ? <li role="status">{labels.recoveryLocked}</li> : null}
      </ul>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <label className="flex items-start gap-2 text-sm text-gray-900 dark:text-gray-100">
          <input checked={isIdentityConfirmed} onChange={(event) => setIsIdentityConfirmed(event.target.checked)} type="checkbox" />
          {labels.recoveryIdentityConfirmed}
        </label>
        <Field autoComplete="off" id="staff-recovery-email" inputMode="email" label={labels.recoveryNewEmail} onChange={setEmail} type="email" value={email} {...(action.error ? { error: action.error } : {})} />
        <div className="flex flex-wrap gap-2">
          <Button isDisabled={action.isRunning || !isIdentityConfirmed || !email} type="submit">{labels.recoverySubmit}</Button>
          {account.isLocked ? <Button isDisabled={action.isRunning} onClick={() => void action.run(() => onRecover({ unlock: true }))} variant="secondary">{labels.recoveryUnlock}</Button> : null}
        </div>
        {action.isDone ? <p className="text-sm text-green-700 dark:text-green-300" role="status">{labels.recoveryDone}</p> : null}
      </form>
    </section>
  )
}
