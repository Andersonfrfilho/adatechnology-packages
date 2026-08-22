/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ReactNode } from 'react'

import { usePasswordReset, PASSWORD_RESET_STEP } from './usePasswordReset'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { DEFAULT_USER_LABELS, type UserLabels } from './workspace/labels'

export type ForgotPasswordScreenProps = {
  readonly onBackToSignIn?: () => void
  readonly labels?: Partial<UserLabels>
  readonly header?: ReactNode
}

export function ForgotPasswordScreen({ onBackToSignIn, labels: overrides, header }: ForgotPasswordScreenProps) {
  const labels = { ...DEFAULT_USER_LABELS, ...overrides }
  const { step, loading, error, requestReset } = usePasswordReset()
  const requested = step === PASSWORD_RESET_STEP.REQUESTED

  return (
    <div className="max-w-sm mx-auto space-y-6">
      {header}
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{labels.forgotPasswordTitle}</h1>
      {requested ? (
        <p className="text-sm text-gray-700 dark:text-gray-300">{labels.forgotPasswordRequestedMessage}</p>
      ) : (
        <ForgotPasswordForm onSubmit={requestReset} loading={loading} error={error} labels={labels} />
      )}
      {onBackToSignIn ? (
        <button type="button" onClick={onBackToSignIn} className="text-sm text-brand-600 dark:text-brand-400 underline">
          {labels.forgotPasswordBackToSignIn}
        </button>
      ) : null}
    </div>
  )
}
