/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AVAILABILITY_EXCEPTION_KIND } from '@adatechnology/scheduling-contracts'
import type { AvailabilityExceptionKind, ResourceId } from '@adatechnology/scheduling-contracts'

import { useAvailabilityExceptions } from '../hooks/useAvailabilityExceptions.query'
import {
  useAddAvailabilityException,
  useRemoveAvailabilityException,
} from '../hooks/useAvailabilityMutations.mutation'
import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'
import { DateTimeField } from './DateTimeField'
import { formatDateTimeLocalInTimeZone, parseDateTimeLocalInTimeZone } from './datetimeLocal.util'

export type AvailabilityExceptionsEditorProps = {
  readonly resourceId: ResourceId
  readonly timezone: string
}

const SELECT_CLASS =
  'min-h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-sm'

export function AvailabilityExceptionsEditor({ resourceId, timezone }: AvailabilityExceptionsEditorProps) {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)
  const { data, isLoading, isError: isLoadError } = useAvailabilityExceptions(resourceId)
  const addException = useAddAvailabilityException()
  const removeException = useRemoveAvailabilityException()

  // Campo separado sempre mostra um dia; texto vazio faria o botao recusar em silencio um
  // formulario que parece preenchido. Vale no primeiro uso e depois de cada adicao.
  const emptyValue = (): string => formatDateTimeLocalInTimeZone(new Date(), timezone)
  const [from, setFrom] = useState(emptyValue)
  const [until, setUntil] = useState(emptyValue)
  const [kind, setKind] = useState<AvailabilityExceptionKind>(AVAILABILITY_EXCEPTION_KIND.BLOCK)
  const [reason, setReason] = useState('')

  async function handleAdd(): Promise<void> {
    if (!from || !until) return
    try {
      await addException.mutateAsync({
        resourceId,
        during: {
          start: parseDateTimeLocalInTimeZone(from, timezone),
          end: parseDateTimeLocalInTimeZone(until, timezone),
        },
        kind,
        ...(reason ? { reason } : {}),
      })
      setFrom(emptyValue())
      setUntil(emptyValue())
      setReason('')
    } catch {
      // H-G: sem isto a rejeição sobe sem tratamento até o `onClick`, que não tem `.catch()` —
      // o alerta abaixo (addException.isError) já mostra a falha ao usuário.
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {messages['availability.exceptionsTitle']}
      </h3>

      {(addException.isError || removeException.isError) && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
          {messages['common.actionFailure']}
        </p>
      )}

      {isLoadError && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
          {messages['common.loadFailure']}
        </p>
      )}

      {isLoading && <p className="text-sm text-gray-500 dark:text-gray-400">{messages['common.loading']}</p>}

      <ul className="space-y-2">
        {(data ?? []).map((exception) => (
          <li key={exception.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1">
              {messages[`availability.exceptionKind.${exception.kind === 'block' ? 'blocked' : 'extra'}`]} —{' '}
              {exception.during.start.toLocaleString(locale)} → {exception.during.end.toLocaleString(locale)}
              {exception.reason ? ` (${exception.reason})` : ''}
            </span>
            <button
              type="button"
              onClick={() => removeException.mutate({ id: exception.id, resourceId })}
              aria-label={messages['availability.removeException']}
              className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-red-700 hover:bg-red-50"
            >
              <Trash2 aria-hidden="true" className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <DateTimeField
          label={messages['availability.exceptionFrom']}
          value={from}
          onChange={setFrom}
        />
        <DateTimeField
          label={messages['availability.exceptionUntil']}
          value={until}
          onChange={setUntil}
        />
        <select
          aria-label={messages['availability.exceptionKind.blocked']}
          value={kind}
          onChange={(event) => setKind(event.target.value as AvailabilityExceptionKind)}
          className={SELECT_CLASS}
        >
          <option value={AVAILABILITY_EXCEPTION_KIND.BLOCK}>{messages['availability.exceptionKind.blocked']}</option>
          <option value={AVAILABILITY_EXCEPTION_KIND.EXTRA}>{messages['availability.exceptionKind.extra']}</option>
        </select>
        <input
          aria-label={messages['availability.exceptionReason']}
          type="text"
          placeholder={messages['availability.exceptionReason']}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={SELECT_CLASS}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={addException.isPending}
          className="inline-flex items-center gap-2 min-h-11 px-3 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Plus aria-hidden="true" className="w-4 h-4" />
          {messages['availability.addException']}
        </button>
      </div>
    </section>
  )
}
