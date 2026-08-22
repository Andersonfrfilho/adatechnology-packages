/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Uma única máquina de estado cobrindo pedido + confirmação (per plano) — `ForgotPasswordScreen`
 * usa `requestReset`, `ResetPasswordScreen` e `ChangePasswordForm` (dentro de `UserWorkspace`) usam
 * `requestReset`/`confirmReset` conforme o fluxo, cada tela com sua própria instância do hook.
 */

import { useCallback, useState } from 'react'

import { useUserApi } from './providers/UserProvider'
import type { ConfirmPasswordResetParams } from './providers/types'

export const PASSWORD_RESET_STEP = {
  REQUEST: 'request',
  REQUESTED: 'requested',
  CONFIRM: 'confirm',
  CONFIRMED: 'confirmed',
} as const
export type PasswordResetStep = (typeof PASSWORD_RESET_STEP)[keyof typeof PASSWORD_RESET_STEP]

export type UsePasswordResetResult = {
  readonly step: PasswordResetStep
  readonly loading: boolean
  readonly error: string | undefined
  readonly requestReset: (email: string) => Promise<void>
  readonly confirmReset: (params: ConfirmPasswordResetParams) => Promise<void>
  readonly reset: () => void
}

export function usePasswordReset(): UsePasswordResetResult {
  const api = useUserApi()
  const [step, setStep] = useState<PasswordResetStep>(PASSWORD_RESET_STEP.REQUEST)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const requestReset = useCallback(
    async (email: string) => {
      setLoading(true)
      setError(undefined)
      try {
        await api.requestPasswordReset(email)
        setStep(PASSWORD_RESET_STEP.REQUESTED)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível solicitar a redefinição')
        throw cause
      } finally {
        setLoading(false)
      }
    },
    [api],
  )

  const confirmReset = useCallback(
    async (params: ConfirmPasswordResetParams) => {
      setLoading(true)
      setError(undefined)
      try {
        await api.confirmPasswordReset(params)
        setStep(PASSWORD_RESET_STEP.CONFIRMED)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível redefinir a senha')
        throw cause
      } finally {
        setLoading(false)
      }
    },
    [api],
  )

  const reset = useCallback(() => {
    setStep(PASSWORD_RESET_STEP.REQUEST)
    setError(undefined)
  }, [])

  return { step, loading, error, requestReset, confirmReset, reset }
}
