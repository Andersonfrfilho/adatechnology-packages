/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ResourceId } from '@adatechnology/scheduling-contracts'

import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'
import { WeeklyRulesEditor } from './WeeklyRulesEditor'
import { AvailabilityExceptionsEditor } from './AvailabilityExceptionsEditor'

export type AvailabilityEditorProps = {
  readonly resourceId: ResourceId
  readonly timezone: string
}

export function AvailabilityEditor({ resourceId, timezone }: AvailabilityEditorProps) {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)

  return (
    <div className="space-y-6">
      <p className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <span className="font-medium">{messages['availability.resourceTimezone']}:</span>
        {timezone}
      </p>
      <WeeklyRulesEditor resourceId={resourceId} />
      <AvailabilityExceptionsEditor resourceId={resourceId} />
    </div>
  )
}
