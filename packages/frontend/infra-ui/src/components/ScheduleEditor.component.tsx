/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useId, useState } from 'react'

import { CalendarClock } from 'lucide-react'

import { ScheduleSwitch } from './ScheduleSwitch.component'
import { WeekdayChips } from './WeekdayChips.component'
import { useSaveEnvironmentSchedule } from '../hooks/infra.hook'
import { useInfraMessages } from '../providers'
import { resolveInfraErrorMessage } from '../utils/infraError.util'
import {
  INFRA_ALERT_ERROR,
  INFRA_BUTTON_PRIMARY,
  INFRA_BUTTON_SECONDARY,
  INFRA_FIELD,
  INFRA_HINT,
  INFRA_LABEL,
} from '../constants/infraStyle.constant'
import { formatNextScheduledAction } from '../utils/scheduledAction.util'
import {
  applyBusinessHours,
  createScheduleDraft,
  toggleWeekday,
  validateScheduleDraft,
  type ScheduleDraft,
} from '../utils/scheduleDraft.util'
import type { InfraEnvironment } from '../types/infra.types'

type ScheduleEditorProps = {
  readonly environment: InfraEnvironment
}

/** Só para ambientes gerenciáveis; o cartão não monta o editor para protegidos. */
export function ScheduleEditor({ environment }: ScheduleEditorProps) {
  const infraLocale = useInfraMessages()
  const [draft, setDraft] = useState<ScheduleDraft>(() => createScheduleDraft(environment.schedule))
  const saveSchedule = useSaveEnvironmentSchedule()
  const powerOnId = useId()
  const powerOffId = useId()
  const validationId = useId()

  const validationErrors = validateScheduleDraft(draft)
  const hasValidationErrors = validationErrors.length > 0
  const savedNextAction = saveSchedule.data?.nextScheduledAction

  function handleDraftChange(next: ScheduleDraft) {
    setDraft(next)
    if (!saveSchedule.isIdle) saveSchedule.reset()
  }

  function handleSave() {
    if (hasValidationErrors) return
    saveSchedule.mutate({ environmentId: environment.environmentId, ...draft })
  }

  return (
    <div className="space-y-4">
      <WeekdayChips
        onToggle={(weekday) => handleDraftChange(toggleWeekday({ draft, weekday }))}
        selectedWeekdays={draft.activeWeekdays}
      />

      <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
        <div>
          <label className={INFRA_LABEL} htmlFor={powerOnId}>
            {infraLocale.schedule.powerOnTime}
          </label>
          <input
            aria-describedby={hasValidationErrors ? validationId : undefined}
            className={INFRA_FIELD}
            id={powerOnId}
            onChange={(event) => handleDraftChange({ ...draft, powerOnTime: event.target.value })}
            required
            type="time"
            value={draft.powerOnTime}
          />
        </div>
        <div>
          <label className={INFRA_LABEL} htmlFor={powerOffId}>
            {infraLocale.schedule.powerOffTime}
          </label>
          <input
            aria-describedby={hasValidationErrors ? validationId : undefined}
            className={INFRA_FIELD}
            id={powerOffId}
            onChange={(event) => handleDraftChange({ ...draft, powerOffTime: event.target.value })}
            required
            type="time"
            value={draft.powerOffTime}
          />
        </div>
      </div>
      <p className={INFRA_HINT}>{infraLocale.schedule.timezoneNote}</p>

      <button
        className={INFRA_BUTTON_SECONDARY}
        onClick={() => handleDraftChange(applyBusinessHours(draft))}
        type="button"
      >
        <CalendarClock aria-hidden="true" className="size-4" />
        {infraLocale.schedule.businessHours}
        <span className="font-normal text-gray-600 dark:text-gray-300">({infraLocale.schedule.businessHoursHint})</span>
      </button>

      <ScheduleSwitch
        isEnabled={draft.isEnabled}
        onChange={(isEnabled) => handleDraftChange({ ...draft, isEnabled })}
      />

      {hasValidationErrors ? (
        <ul className="space-y-1 text-sm text-red-700 dark:text-red-300" id={validationId}>
          {validationErrors.map((validationError) => (
            <li key={validationError}>{infraLocale.schedule.validation[validationError]}</li>
          ))}
        </ul>
      ) : null}

      {saveSchedule.isError ? (
        <p className={INFRA_ALERT_ERROR} role="alert">
          {resolveInfraErrorMessage(saveSchedule.error, infraLocale)}
        </p>
      ) : null}

      {saveSchedule.isSuccess ? (
        <p className="text-sm text-emerald-800 dark:text-emerald-300" role="status">
          {infraLocale.schedule.saved}
          {savedNextAction
            ? ` ${infraLocale.schedule.next}: ${formatNextScheduledAction({ nextScheduledAction: savedNextAction, now: new Date(), messages: infraLocale })}`
            : ''}
        </p>
      ) : null}

      <button
        className={INFRA_BUTTON_PRIMARY}
        disabled={hasValidationErrors || saveSchedule.isPending}
        onClick={handleSave}
        type="button"
      >
        {saveSchedule.isPending ? infraLocale.schedule.saving : infraLocale.schedule.save}
      </button>
    </div>
  )
}
