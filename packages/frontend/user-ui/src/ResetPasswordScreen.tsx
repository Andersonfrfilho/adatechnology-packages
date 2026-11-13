/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * `token` vem do host — extração de query string/rota é responsabilidade do roteador da aplicação,
 * não deste pacote.
 */

import { useCallback, type ReactNode } from 'react'

import { usePasswordReset, PASSWORD_RESET_STEP } from './usePasswordReset'
import { ResetPasswordForm } from './ResetPasswordForm'
import { DEFAULT_USER_LABELS, type UserLabels } from './workspace/labels'

export type ResetPasswordScreenProps = {
  readonly token: string
  readonly onBackToSignIn?: () => void
  readonly labels?: Partial<UserLabels>
  readonly header?: ReactNode
}

export function ResetPasswordScreen({ token, onBackToSignIn, labels: overrides, header }: ResetPasswordScreenProps) {
  const labels = { ...DEFAULT_USER_LABELS, ...overrides }
  const { step, loading, error, confirmReset } = usePasswordReset()
  const confirmed = step === PASSWORD_RESET_STEP.CONFIRMED

  const handleSubmit = useCallback((newPassword: string) => confirmReset({ token, newPassword }), [confirmReset, token])

  return (
    <div className="max-w-sm mx-auto space-y-6">
      {header}
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{labels.resetPasswordTitle}</h1>
      {confirmed ? (
        <p className="text-sm text-gray-700 dark:text-gray-300">{labels.resetPasswordConfirmedMessage}</p>
      ) : (
        <ResetPasswordForm onSubmit={handleSubmit} loading={loading} error={error} labels={labels} />
      )}
      {onBackToSignIn ? (
        <button type="button" onClick={onBackToSignIn} className="text-sm text-brand-600 dark:text-brand-400 underline">
          {labels.resetPasswordBackToSignIn}
        </button>
      ) : null}
    </div>
  )
}
