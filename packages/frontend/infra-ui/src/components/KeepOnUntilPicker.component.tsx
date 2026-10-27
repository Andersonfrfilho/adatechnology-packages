/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useInfraMessages } from '../providers'
import { INFRA_FOCUS_RING, INFRA_HINT } from '../constants/infraStyle.constant'
import type { KeepOnOptionId } from '../constants/infraUi.constant'
import type { KeepOnUntilOption } from '../utils/keepOnUntil.util'
import { formatMoment } from '../utils/scheduledAction.util'
import { fillTemplate } from '../utils/zonedTime.util'

type KeepOnUntilPickerProps = {
  readonly options: readonly KeepOnUntilOption[]
  readonly selectedId: KeepOnOptionId
  readonly now: Date
  readonly onSelect: (id: KeepOnOptionId) => void
}

export function KeepOnUntilPicker({ options, selectedId, now, onSelect }: KeepOnUntilPickerProps) {
  const infraLocale = useInfraMessages()
  const selected = options.find((option) => option.id === selectedId)
  const untilText = selected
    ? fillTemplate({
        template: infraLocale.keepOn.until,
        values: { moment: formatMoment({ at: new Date(selected.until), now, messages: infraLocale }) },
      })
    : ''

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-gray-900 dark:text-gray-200">{infraLocale.keepOn.label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium has-[:checked]:border-brand-600 has-[:checked]:bg-brand-600 has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500 border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:has-[:checked]:border-brand-400 dark:has-[:checked]:bg-brand-500 ${INFRA_FOCUS_RING}`}
            key={option.id}
          >
            <input
              checked={option.id === selectedId}
              className="sr-only"
              name="keep-on-until"
              onChange={() => onSelect(option.id)}
              type="radio"
              value={option.id}
            />
            {infraLocale.keepOn[option.id]}
          </label>
        ))}
      </div>
      <p className={INFRA_HINT}>
        <span className="font-medium tabular-nums">{untilText}</span> {infraLocale.keepOn.hint}
      </p>
    </fieldset>
  )
}
