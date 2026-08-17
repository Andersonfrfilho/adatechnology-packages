/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { AvailabilityRule, ResourceId } from '@adatechnology/scheduling-contracts'

import { useAvailabilityRules } from '../hooks/useAvailabilityRules.query'
import { useSetAvailabilityRules } from '../hooks/useAvailabilityMutations.mutation'
import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'

export type WeeklyRulesEditorProps = {
  readonly resourceId: ResourceId
}

type WeeklyRuleDraft = {
  readonly weekday: number
  readonly startsAtLocal: string
  readonly endsAtLocal: string
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const

function toDraft(rule: AvailabilityRule): WeeklyRuleDraft {
  return { weekday: rule.weekday, startsAtLocal: rule.startsAtLocal, endsAtLocal: rule.endsAtLocal }
}

function createEmptyDraft(): WeeklyRuleDraft {
  return { weekday: 1, startsAtLocal: '09:00', endsAtLocal: '18:00' }
}

export function WeeklyRulesEditor({ resourceId }: WeeklyRulesEditorProps) {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)
  const { data, isSuccess: isRulesLoaded, isError: isRulesLoadError } = useAvailabilityRules(resourceId)
  const setAvailabilityRules = useSetAvailabilityRules()

  const [draft, setDraft] = useState<readonly WeeklyRuleDraft[] | undefined>(undefined)
  const rules = draft ?? (data ? data.map(toDraft) : [])

  function updateRule(index: number, patch: Partial<WeeklyRuleDraft>): void {
    setDraft(rules.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...patch } : rule)))
  }

  function removeRule(index: number): void {
    setDraft(rules.filter((_rule, ruleIndex) => ruleIndex !== index))
  }

  function addRule(): void {
    setDraft([...rules, createEmptyDraft()])
  }

  async function handleSave(): Promise<void> {
    try {
      await setAvailabilityRules.mutateAsync({
        resourceId,
        rules: rules.map((rule) => ({ ...rule, resourceId })),
      })
      setDraft(undefined)
    } catch {
      // H-G: sem isto a rejeição sobe sem tratamento até o `onClick`, que não tem `.catch()` —
      // o alerta abaixo (setAvailabilityRules.isError) já mostra a falha ao usuário.
    }
  }

  if (isRulesLoadError) {
    return (
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {messages['availability.weeklyRulesTitle']}
        </h3>
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
          {messages['common.loadFailure']}
        </p>
      </section>
    )
  }

  if (!isRulesLoaded) {
    return (
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {messages['availability.weeklyRulesTitle']}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{messages['common.loading']}</p>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {messages['availability.weeklyRulesTitle']}
      </h3>

      {setAvailabilityRules.isError && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
          {messages['common.actionFailure']}
        </p>
      )}

      <ul className="space-y-2">
        {rules.map((rule, index) => (
          <li key={index} className="flex items-center gap-2">
            <select
              aria-label={messages['availability.weekdayLabel']}
              value={rule.weekday}
              onChange={(event) => updateRule(index, { weekday: Number(event.target.value) })}
              className="min-h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-sm"
            >
              {WEEKDAYS.map((weekday) => (
                <option key={weekday} value={weekday}>
                  {messages[`availability.weekday.${weekday}` as keyof typeof messages]}
                </option>
              ))}
            </select>
            <input
              aria-label={messages['availability.startsAtLocal']}
              type="time"
              value={rule.startsAtLocal}
              onChange={(event) => updateRule(index, { startsAtLocal: event.target.value })}
              className="min-h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-sm"
            />
            <input
              aria-label={messages['availability.endsAtLocal']}
              type="time"
              value={rule.endsAtLocal}
              onChange={(event) => updateRule(index, { endsAtLocal: event.target.value })}
              className="min-h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-sm"
            />
            <button
              type="button"
              onClick={() => removeRule(index)}
              aria-label={messages['availability.removeRule']}
              className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-red-700 hover:bg-red-50"
            >
              <Trash2 aria-hidden="true" className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={addRule}
          className="inline-flex items-center gap-2 min-h-11 px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <Plus aria-hidden="true" className="w-4 h-4" />
          {messages['availability.addRule']}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={setAvailabilityRules.isPending}
          className="min-h-11 px-3 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {messages['common.save']}
        </button>
      </div>
    </section>
  )
}
