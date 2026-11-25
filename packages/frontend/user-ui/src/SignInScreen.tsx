/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useCallback, type ReactNode } from 'react'

import { useSignIn } from './useSignIn'
import { SignInForm } from './SignInForm'
import type { SignInParams } from './providers/types'
import { DEFAULT_USER_LABELS, type UserLabels } from './workspace/labels'

export type SignInScreenProps = {
  readonly onSignedIn?: () => void
  readonly onForgotPassword?: () => void
  readonly labels?: Partial<UserLabels>
  readonly header?: ReactNode
  readonly footer?: ReactNode
  /** Mostra a caixa "Lembrar de mim". Ausente = tela de sempre. */
  readonly showRememberMe?: boolean
}

export function SignInScreen({
  onSignedIn,
  onForgotPassword,
  labels: overrides,
  header,
  footer,
  showRememberMe,
}: SignInScreenProps) {
  const labels = { ...DEFAULT_USER_LABELS, ...overrides }
  const { loading, error, signIn } = useSignIn()

  const handleSubmit = useCallback(
    async (params: SignInParams) => {
      await signIn(params)
      onSignedIn?.()
    },
    [signIn, onSignedIn],
  )

  return (
    <div className="max-w-sm mx-auto space-y-6">
      {header}
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{labels.signInTitle}</h1>
      <SignInForm
        onSubmit={handleSubmit}
        onForgotPassword={onForgotPassword}
        loading={loading}
        error={error}
        labels={labels}
        showRememberMe={showRememberMe}
      />
      {footer}
    </div>
  )
}
