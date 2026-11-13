/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useId, useMemo, useState } from 'react'
import { RESOURCE_KIND, type CreateResourceInput, type Resource, type UpdateResourceInput } from '@adatechnology/scheduling-contracts'

import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'
import { SelectField, type SelectOption } from './SelectField'

export type ResourceFormProps = {
  readonly initialValues?: Resource
  readonly onSubmit: (input: CreateResourceInput & UpdateResourceInput) => Promise<void>
}

const INPUT_CLASS =
  'w-full min-h-11 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-900'
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
const BUTTON_PRIMARY =
  'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-11 bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50'

const FALLBACK_TIMEZONES: readonly string[] = ['America/Sao_Paulo', 'America/Manaus', 'America/Belem', 'UTC']

/**
 * `supportedValuesOf` é ES2022 e o `lib` deste pacote não a declara. Tipar aqui é mais barato do que
 * subir o `lib` de uma biblioteca publicada, que mudaria o alvo para todo host que a consome.
 */
type IntlWithSupportedValues = typeof Intl & {
  readonly supportedValuesOf?: (key: 'timeZone') => readonly string[]
}

/**
 * `Intl.supportedValuesOf` é o catálogo do próprio runtime — datilografar fuso à mão erra a grafia
 * e só falha na hora de calcular horário. O valor já salvo entra na lista mesmo se o runtime não o
 * conhecer, senão editar um recurso antigo apagaria o fuso dele em silêncio.
 */
function buildTimezoneOptions(current: string): readonly SelectOption[] {
  const supported = (Intl as IntlWithSupportedValues).supportedValuesOf?.('timeZone') ?? FALLBACK_TIMEZONES
  const zones = supported.includes(current) ? supported : [current, ...supported]

  return zones.map((zone) => ({ value: zone, label: zone.replace(/_/g, ' ') }))
}

export function ResourceForm({ initialValues, onSubmit }: ResourceFormProps) {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)

  // L-013: id fixo colide se duas instâncias do formulário montarem ao mesmo tempo (ex.: criar
  // recurso num modal enquanto outro já está aberto) — `useId()` gera um por instância de componente.
  const formId = useId()
  const nameId = `${formId}-name`

  const [name, setName] = useState(initialValues?.name ?? '')
  const [kind, setKind] = useState(initialValues?.kind ?? RESOURCE_KIND.PERSON)
  const [timezone, setTimezone] = useState(initialValues?.timezone ?? 'America/Sao_Paulo')
  const [active, setActive] = useState(initialValues?.active ?? true)
  const [submitting, setSubmitting] = useState(false)

  const kindOptions = useMemo<readonly SelectOption[]>(
    () => [
      { value: RESOURCE_KIND.PERSON, label: messages['resource.kind.person'] },
      { value: RESOURCE_KIND.ROOM, label: messages['resource.kind.room'] },
      { value: RESOURCE_KIND.EQUIPMENT, label: messages['resource.kind.equipment'] },
    ],
    [messages],
  )
  const timezoneOptions = useMemo(() => buildTimezoneOptions(timezone), [timezone])

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

      <SelectField
        label={messages['resource.kind']}
        value={kind}
        options={kindOptions}
        onChange={(next) => setKind(next as typeof kind)}
      />

      <SelectField
        label={messages['resource.timezone']}
        value={timezone}
        options={timezoneOptions}
        onChange={setTimezone}
        searchable
      />

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
