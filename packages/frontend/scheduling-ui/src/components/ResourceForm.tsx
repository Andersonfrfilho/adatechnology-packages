/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useId, useState } from 'react'
import { RESOURCE_KIND, type CreateResourceInput, type Resource, type UpdateResourceInput } from '@adatechnology/scheduling-contracts'

import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'

export type ResourceFormProps = {
  readonly initialValues?: Resource
  readonly onSubmit: (input: CreateResourceInput & UpdateResourceInput) => Promise<void>
}

const INPUT_CLASS =
  'w-full min-h-11 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-900'
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
const BUTTON_PRIMARY =
  'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-11 bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50'

export function ResourceForm({ initialValues, onSubmit }: ResourceFormProps) {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)

  // L-013: id fixo colide se duas instâncias do formulário montarem ao mesmo tempo (ex.: criar
  // recurso num modal enquanto outro já está aberto) — `useId()` gera um por instância de componente.
  const formId = useId()
  const nameId = `${formId}-name`
  const kindId = `${formId}-kind`
  const timezoneId = `${formId}-timezone`

  const [name, setName] = useState(initialValues?.name ?? '')
  const [kind, setKind] = useState(initialValues?.kind ?? RESOURCE_KIND.PERSON)
  const [timezone, setTimezone] = useState(initialValues?.timezone ?? 'America/Sao_Paulo')
  const [active, setActive] = useState(initialValues?.active ?? true)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit({ name, kind, timezone, active })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor={nameId} className={LABEL_CLASS}>
          {messages['resource.name']}
        </label>
        <input
          id={nameId}
          type="text"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      <div>
        <label htmlFor={kindId} className={LABEL_CLASS}>
          {messages['resource.kind']}
        </label>
        <select
          id={kindId}
          value={kind}
          onChange={(event) => setKind(event.target.value as typeof kind)}
          className={INPUT_CLASS}
        >
          <option value={RESOURCE_KIND.PERSON}>{messages['resource.kind.person']}</option>
          <option value={RESOURCE_KIND.ROOM}>{messages['resource.kind.room']}</option>
          <option value={RESOURCE_KIND.EQUIPMENT}>{messages['resource.kind.equipment']}</option>
        </select>
      </div>

      <div>
        <label htmlFor={timezoneId} className={LABEL_CLASS}>
          {messages['resource.timezone']}
        </label>
        <input
          id={timezoneId}
          type="text"
          required
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          placeholder="America/Sao_Paulo"
          className={INPUT_CLASS}
        />
      </div>

      {initialValues && (
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 min-h-11">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          {messages['resource.active']}
        </label>
      )}

      <button type="submit" disabled={submitting} className={BUTTON_PRIMARY}>
        {messages['common.save']}
      </button>
    </form>
  )
}
