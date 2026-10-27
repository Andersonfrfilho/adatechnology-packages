/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Info, RefreshCw } from 'lucide-react'

import { INFRA_ERROR_CODE } from '../constants/infra.constant'
import { useInfraMessages } from '../providers'
import { getErrorCode } from '../utils/errorCode.util'
import { resolveInfraErrorMessage } from '../utils/infraError.util'
import { INFRA_ALERT_ERROR, INFRA_BUTTON_SECONDARY, INFRA_PANEL_CARD } from '../constants/infraStyle.constant'

type InfraQueryErrorProps = {
  readonly error: unknown
  readonly failureMessage: string
  readonly retryLabel: string
  readonly onRetry: () => void
}

export function InfraQueryError({ error, failureMessage, retryLabel, onRetry }: InfraQueryErrorProps) {
  const infraLocale = useInfraMessages()
  const isNotConfigured = getErrorCode(error) === INFRA_ERROR_CODE.NOT_CONFIGURED

  if (isNotConfigured) {
    return (
      <section className={`${INFRA_PANEL_CARD} flex items-start gap-3 p-5`} role="status">
        <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-600 dark:text-brand-400" />
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{infraLocale.notConfigured.title}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">{infraLocale.notConfigured.description}</p>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-3">
      <p className={INFRA_ALERT_ERROR} role="alert">
        {failureMessage} {resolveInfraErrorMessage(error, infraLocale)}
      </p>
      <button className={INFRA_BUTTON_SECONDARY} onClick={onRetry} type="button">
        <RefreshCw aria-hidden="true" className="size-4" />
        {retryLabel}
      </button>
    </div>
  )
}
