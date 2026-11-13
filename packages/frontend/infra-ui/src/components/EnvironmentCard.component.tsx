/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useId } from 'react'

import { ClassificationBadge } from './ClassificationBadge.component'
import { EnvironmentStateBadge } from './EnvironmentStateBadge.component'
import { EnvironmentStatusLines } from './EnvironmentStatusLines.component'
import { PowerActions } from './PowerActions.component'
import { ScheduleSection } from './ScheduleSection.component'
import { ServiceList } from './ServiceList.component'
import { INFRA_ENVIRONMENT_CLASSIFICATION } from '../constants/infra.constant'
import { useInfraCapabilities, useInfraMessages } from '../providers'
import { INFRA_PANEL_CARD } from '../constants/infraStyle.constant'
import type { InfraEnvironment } from '../types/infra.types'

type EnvironmentCardProps = {
  readonly environment: InfraEnvironment
}

export function EnvironmentCard({ environment }: EnvironmentCardProps) {
  const infraLocale = useInfraMessages()
  const { canPower, canSaveSchedule } = useInfraCapabilities()
  const headingId = useId()
  const isManaged = environment.classification === INFRA_ENVIRONMENT_CLASSIFICATION.MANAGED
  const isProtected = environment.classification === INFRA_ENVIRONMENT_CLASSIFICATION.PROTECTED

  return (
    <article aria-labelledby={headingId} className={`${INFRA_PANEL_CARD} space-y-3 p-4`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="break-all text-base font-semibold text-gray-900 dark:text-white" id={headingId}>
          {environment.environmentName}
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <ClassificationBadge classification={environment.classification} />
          <EnvironmentStateBadge state={environment.state} />
        </div>
      </header>

      <EnvironmentStatusLines environment={environment} />
      <ServiceList environment={environment} services={environment.services} />

      {isProtected ? (
        <p className="text-xs text-gray-600 dark:text-gray-300">{infraLocale.environments.protectedHint}</p>
      ) : null}

      {isManaged ? (
        <>
          {canPower ? <PowerActions environment={environment} /> : null}
          {canSaveSchedule ? <ScheduleSection environment={environment} /> : null}
        </>
      ) : null}
    </article>
  )
}
