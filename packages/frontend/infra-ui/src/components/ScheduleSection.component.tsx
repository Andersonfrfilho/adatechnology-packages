/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraMessages } from '../locales'
import { useInfraMessages } from '../providers'
import { ScheduleEditor } from './ScheduleEditor.component'
import { INFRA_DISCLOSURE_SUMMARY, INFRA_FOCUS_RING } from '../constants/infraStyle.constant'
import type { InfraEnvironment } from '../types/infra.types'

type ScheduleSectionProps = {
  readonly environment: InfraEnvironment
}

function resolveScheduleSummary(environment: InfraEnvironment, infraLocale: InfraMessages): string {
  if (!environment.schedule) return infraLocale.schedule.none

  return environment.schedule.isEnabled ? infraLocale.schedule.enabled : infraLocale.schedule.paused
}

export function ScheduleSection({ environment }: ScheduleSectionProps) {
  const infraLocale = useInfraMessages()

  return (
    <details>
      <summary className={`${INFRA_DISCLOSURE_SUMMARY} ${INFRA_FOCUS_RING}`}>
        {infraLocale.schedule.title}
        <span className="ml-2 font-normal text-gray-600 dark:text-gray-300">
          {resolveScheduleSummary(environment, infraLocale)}
        </span>
      </summary>
      <div className="mt-3">
        <ScheduleEditor environment={environment} />
      </div>
    </details>
  )
}
