/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useState } from 'react'
import type { CreateServiceInput, Service, UpdateServiceInput } from '@adatechnology/scheduling-contracts'

import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'

export type ServiceFormProps = {
  readonly initialValues?: Service
  readonly onSubmit: (input: CreateServiceInput & UpdateServiceInput) => Promise<void>
}

const INPUT_CLASS =
  'w-full min-h-11 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-900'
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
const BUTTON_PRIMARY =
  'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-11 bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50'

export function ServiceForm({ initialValues, onSubmit }: ServiceFormProps) {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)

  const [name, setName] = useState(initialValues?.name ?? '')
  const [durationMinutes, setDurationMinutes] = useState(initialValues?.durationMinutes ?? 30)
  const [bufferBeforeMinutes, setBufferBeforeMinutes] = useState(initialValues?.bufferBeforeMinutes ?? 0)
  const [bufferAfterMinutes, setBufferAfterMinutes] = useState(initialValues?.bufferAfterMinutes ?? 0)
  const [active, setActive] = useState(initialValues?.active ?? true)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit({ name, durationMinutes, bufferBeforeMinutes, bufferAfterMinutes, active })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="scheduling-service-name" className={LABEL_CLASS}>
          {messages['service.name']}
        </label>
        <input
          id="scheduling-service-name"
          type="text"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      <div>
        <label htmlFor="scheduling-service-duration" className={LABEL_CLASS}>
          {messages['service.durationMinutes']}
        </label>
        <input
          id="scheduling-service-duration"
          type="number"
          min={1}
          required
          value={durationMinutes}
          onChange={(event) => setDurationMinutes(Number(event.target.value))}
          className={INPUT_CLASS}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="scheduling-service-buffer-before" className={LABEL_CLASS}>
            {messages['service.bufferBeforeMinutes']}
          </label>
          <input
            id="scheduling-service-buffer-before"
            type="number"
            min={0}
            value={bufferBeforeMinutes}
            onChange={(event) => setBufferBeforeMinutes(Number(event.target.value))}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="scheduling-service-buffer-after" className={LABEL_CLASS}>
            {messages['service.bufferAfterMinutes']}
          </label>
          <input
            id="scheduling-service-buffer-after"
            type="number"
            min={0}
            value={bufferAfterMinutes}
            onChange={(event) => setBufferAfterMinutes(Number(event.target.value))}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      {initialValues && (
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 min-h-11">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          {messages['service.active']}
        </label>
      )}

      <button type="submit" disabled={submitting} className={BUTTON_PRIMARY}>
        {messages['common.save']}
      </button>
    </form>
  )
}
