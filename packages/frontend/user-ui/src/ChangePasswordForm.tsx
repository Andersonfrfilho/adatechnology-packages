/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * `user-module` não expõe "trocar senha com a senha atual" — só o fluxo de reset por token
 * (`confirmPasswordReset`). Por isso este componente não pede senha alguma: dispara o mesmo
 * `requestPasswordReset` para o e-mail do próprio usuário logado, e o resto acontece pelo link
 * recebido por e-mail (`ResetPasswordScreen`).
 */

import { DEFAULT_USER_LABELS, type UserLabels } from './workspace/labels'

export type ChangePasswordFormProps = {
  readonly onRequest: () => Promise<void>
  readonly loading?: boolean
  readonly error?: string
  readonly sent?: boolean
  readonly labels?: Partial<UserLabels>
}

export function ChangePasswordForm({ onRequest, loading = false, error, sent = false, labels: overrides }: ChangePasswordFormProps) {
  const labels = { ...DEFAULT_USER_LABELS, ...overrides }

  if (sent) {
    return <p className="text-sm text-gray-700 dark:text-gray-300">{labels.changePasswordSentMessage}</p>
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void onRequest()}
        disabled={loading}
        className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 disabled:opacity-60"
      >
        {labels.changePassword}
      </button>
    </div>
  )
}
