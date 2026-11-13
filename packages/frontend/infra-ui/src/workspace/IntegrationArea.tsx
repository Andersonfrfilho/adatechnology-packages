/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useState } from 'react'

import { CircleCheck, RefreshCw } from 'lucide-react'

import { InfraPageHeader } from '../components/InfraPageHeader.component'
import { IntegrationForm } from '../components/IntegrationForm.component'
import { IntegrationNotice } from '../components/IntegrationNotice.component'
import { IntegrationNotices } from '../components/IntegrationNotices.component'
import { IntegrationStatus } from '../components/IntegrationStatus.component'
import { RemoveIntegrationSection } from '../components/RemoveIntegrationSection.component'
import { INFRA_INTEGRATION_SOURCE } from '../constants/infraIntegration.constant'
import { INFRA_BUTTON_SECONDARY } from '../constants/infraStyle.constant'
import { useInfraIntegration } from '../hooks/infraIntegration.hook'
import { useInfraCapabilities, useInfraMessages, type InfraTokenSource } from '../providers'
import { isInformationalIntegrationError, resolveIntegrationErrorMessage } from '../utils/infraIntegration.util'

export type IntegrationAreaProps = {
  /** Onde o operador gera o token no provedor. Ausente, o link não é desenhado. */
  readonly tokenSource?: InfraTokenSource
}

export function IntegrationArea({ tokenSource }: IntegrationAreaProps) {
  const messages = useInfraMessages()
  const locale = messages.integration
  const { canSaveIntegration, canRemoveIntegration } = useInfraCapabilities()
  const { data, isPending, isError, error, refetch } = useInfraIntegration()
  const [wasRemoved, setWasRemoved] = useState(false)

  const isPanelSource = data?.source === INFRA_INTEGRATION_SOURCE.PANEL
  const canEdit = canSaveIntegration && data !== undefined && data.source !== INFRA_INTEGRATION_SOURCE.ENVIRONMENT
  const showRemovedNotice = wasRemoved && data?.source === INFRA_INTEGRATION_SOURCE.NONE

  return (
    <section className="h-full min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <InfraPageHeader subtitle={locale.subtitle} title={locale.title} />

      <div className="max-w-3xl space-y-4">
        {isPending ? (
          <p className="text-sm text-gray-500 dark:text-gray-400" role="status">
            {locale.loading}
          </p>
        ) : null}

        {isError ? (
          <div className="space-y-3">
            <IntegrationNotice
              isInformational={isInformationalIntegrationError(error)}
              message={`${locale.loadFailed} ${resolveIntegrationErrorMessage(error, messages)}`}
            />
            {isInformationalIntegrationError(error) ? null : (
              <button className={INFRA_BUTTON_SECONDARY} onClick={() => void refetch()} type="button">
                <RefreshCw aria-hidden="true" className="size-4" />
                {locale.retry}
              </button>
            )}
          </div>
        ) : null}

        {showRemovedNotice ? (
          <p
            className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100"
            role="status"
          >
            <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {locale.remove.removed}
          </p>
        ) : null}

        {data ? (
          <>
            <IntegrationNotices tokenSource={tokenSource} view={data} />
            <IntegrationStatus view={data} />
            {canEdit ? <IntegrationForm view={data} /> : null}
            {isPanelSource && canRemoveIntegration ? (
              <RemoveIntegrationSection onRemoved={() => setWasRemoved(true)} tokenSource={tokenSource} />
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
