/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { CircleAlert, Info } from 'lucide-react'

import { INFRA_ALERT_ERROR } from '../constants/infraStyle.constant'

type IntegrationNoticeProps = {
  readonly message: string
  readonly isInformational: boolean
}

const INFORMATIONAL_CLASSES =
  'flex items-start gap-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100'

/** Erro vira alerta vermelho; o que e so informacao (ex.: fora de producao) nao assusta. */
export function IntegrationNotice({ message, isInformational }: IntegrationNoticeProps) {
  if (isInformational) {
    return (
      <p className={INFORMATIONAL_CLASSES} role="status">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {message}
      </p>
    )
  }

  return (
    <p className={`${INFRA_ALERT_ERROR} flex items-start gap-2`} role="alert">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  )
}
