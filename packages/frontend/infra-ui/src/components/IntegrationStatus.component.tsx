/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useId, useState } from 'react'

import { IntegrationBadge } from './IntegrationBadge.component'
import { IntegrationStatusRow } from './IntegrationStatusRow.component'
import { VerifyAccessButton } from './VerifyAccessButton.component'
import type { InfraAccessStatus } from '../constants/infra.constant'
import { useInfraCapabilities, useInfraMessages } from '../providers'
import type { InfraMessages } from '../locales'
import { INFRA_INTEGRATION_SOURCE, INFRA_INTEGRATION_STATE } from '../constants/infraIntegration.constant'
import {
  describeIntegrationAccess,
  describeIntegrationState,
  formatIntegrationUpdatedAt,
} from '../utils/infraIntegration.util'
import { INFRA_PANEL_CARD } from '../constants/infraStyle.constant'
import type { InfraIntegrationView } from '../types/infraIntegration.types'
import { fillTemplate } from '../utils/zonedTime.util'

type IntegrationStatusProps = {
  readonly view: InfraIntegrationView
}

export function IntegrationStatus({ view }: IntegrationStatusProps) {
  const infraLocale = useInfraMessages()
  const { canVerifyIntegration } = useInfraCapabilities()
  const locale = infraLocale.integration
  const titleId = useId()
  const [verifiedAccess, setVerifiedAccess] = useState<InfraAccessStatus | undefined>(undefined)
  const state = describeIntegrationState(view.state, infraLocale)
  const canVerify =
    canVerifyIntegration &&
    view.source !== INFRA_INTEGRATION_SOURCE.NONE &&
    view.state === INFRA_INTEGRATION_STATE.CONFIGURED
  const updatedAt = view.updatedAt ? formatIntegrationUpdatedAt(view.updatedAt) : undefined
  const effectiveAccess = canVerify ? (verifiedAccess ?? view.access) : view.access
  const access = describeIntegrationAccess(effectiveAccess, infraLocale)

  return (
    <section aria-labelledby={titleId} className={`${INFRA_PANEL_CARD} space-y-4 p-4 md:p-5`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white" id={titleId}>
          {locale.status.title}
        </h2>
        <IntegrationBadge label={state.title} tone={state.tone} />
      </header>
      <p className="text-sm text-gray-600 dark:text-gray-300">{state.action}</p>

      <dl className="grid gap-4 sm:grid-cols-2">
        <IntegrationStatusRow label={locale.status.source}>{locale.sources[view.source]}</IntegrationStatusRow>
        <IntegrationStatusRow label={locale.status.workspace}>
          {view.workspaceId ?? locale.status.workspaceNone}
        </IntegrationStatusRow>
        {view.tokenHint ? (
          <IntegrationStatusRow label={locale.status.token}>
            {fillTemplate({ template: locale.status.tokenHint, values: { hint: view.tokenHint } })}
          </IntegrationStatusRow>
        ) : null}
        {updatedAt ? (
          <IntegrationStatusRow label={locale.status.lastChange}>
            {describeUpdate(view, updatedAt, locale)}
          </IntegrationStatusRow>
        ) : null}
      </dl>

      <div className="space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{locale.status.access}</span>
          <IntegrationBadge label={access.label} tone={access.tone} />
        </div>
        {effectiveAccess ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">{infraLocale.access[effectiveAccess]}</p>
        ) : null}
        {canVerify ? <VerifyAccessButton onVerified={setVerifiedAccess} /> : null}
      </div>
    </section>
  )
}

function describeUpdate(view: InfraIntegrationView, moment: string, locale: InfraMessages['integration']): string {
  if (!view.updatedByName) return fillTemplate({ template: locale.status.updatedAnonymous, values: { moment } })

  return fillTemplate({ template: locale.status.updated, values: { name: view.updatedByName, moment } })
}
