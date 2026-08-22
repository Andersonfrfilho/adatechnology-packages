/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Export composto obrigatório (`pluggable-module.md` §4) — tela de conta do usuário já logado.
 * Compõe `useProfile` + `usePasswordReset` diretamente; não existe um `useUserWorkspace`
 * monolítico porque, ao contrário de `products-ui`, aqui não há listagem/paginação/filtro a
 * coordenar — só os dois hooks de fluxo já cobrem o estado necessário.
 */

import { useCallback, type ReactNode } from 'react'

import { useProfile } from '../useProfile'
import { usePasswordReset, PASSWORD_RESET_STEP } from '../usePasswordReset'
import { ProfileEditForm } from '../ProfileEditForm'
import { ChangePasswordForm } from '../ChangePasswordForm'
import { DEFAULT_USER_LABELS, type UserLabels } from './labels'

export type UserWorkspaceProps = {
  readonly labels?: Partial<UserLabels>
  readonly header?: ReactNode
}

export function UserWorkspace({ labels: overrides, header }: UserWorkspaceProps) {
  const labels = { ...DEFAULT_USER_LABELS, ...overrides }
  const { profile, loading: profileLoading, error: profileError, updateProfile } = useProfile()
  const { step, loading: resetLoading, error: resetError, requestReset } = usePasswordReset()

  const handleChangePassword = useCallback(async () => {
    if (profile) await requestReset(profile.email)
  }, [profile, requestReset])

  if (!profile) return null

  return (
    <div className="max-w-md mx-auto space-y-8">
      {header}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{labels.profileTitle}</h2>
        <ProfileEditForm profile={profile} onSubmit={updateProfile} loading={profileLoading} error={profileError} labels={labels} />
      </section>
      <section className="space-y-2">
        <ChangePasswordForm
          onRequest={handleChangePassword}
          loading={resetLoading}
          error={resetError}
          sent={step === PASSWORD_RESET_STEP.REQUESTED}
          labels={labels}
        />
      </section>
    </div>
  )
}
