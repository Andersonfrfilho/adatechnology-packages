/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Some inteira quando a `UserApi` não traz `signUp` — cadastro público é opt-in do host.
 */

import { useCallback, type ReactNode } from 'react'

import { SignUpForm } from './SignUpForm'
import { useSignUp } from './useSignUp'
import type { SignUpParams } from './providers/types'
import { DEFAULT_USER_LABELS, type UserLabels } from './workspace/labels'

export type SignUpScreenProps = {
  readonly onSignedUp?: () => void
  readonly onSignInInstead?: () => void
  readonly labels?: Partial<UserLabels>
  readonly header?: ReactNode
  readonly footer?: ReactNode
}

export function SignUpScreen({ onSignedUp, onSignInInstead, labels: overrides, header, footer }: SignUpScreenProps) {
  const labels = { ...DEFAULT_USER_LABELS, ...overrides }
  const { enabled, loading, error, signUp } = useSignUp()

  const handleSubmit = useCallback(
    async (params: SignUpParams) => {
      await signUp(params)
      onSignedUp?.()
    },
    [signUp, onSignedUp],
  )

  if (!enabled) return null

  return (
    <div className="max-w-sm mx-auto space-y-6">
      {header}
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{labels.signUpTitle}</h1>
      <SignUpForm
        onSubmit={handleSubmit}
        {...(onSignInInstead ? { onSignInInstead } : {})}
        loading={loading}
        {...(error ? { error } : {})}
        labels={labels}
      />
      {footer}
    </div>
  )
}
