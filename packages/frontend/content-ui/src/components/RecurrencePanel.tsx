/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Publicação automática: regras que publicam um post novo, copiado de um modelo, toda semana ou mês.
 */

import {
  RECURRENCE_FREQUENCY,
  type PostSummary,
  type RecurrenceFrequency,
  type RecurrenceRule,
} from '@adatechnology/content-contracts'
import { CirclePause, CirclePlay, Plus, Repeat, Trash2 } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

import { useAsyncResource } from '../hooks/useAsyncResource'
import { formatPostDate, fromDateTimeLocalValue, toDateTimeLocalValue } from '../lib/format'
import { useContentAdminApi, useContentText } from '../providers/ContentProvider'
import type { RenderDateTimeInput, RenderSelect } from '../providers/types'
import { ActionDialog } from './ActionDialog'
import { DateTimeField } from './DateTimeField'
import { SelectField } from './SelectField'
import { Tooltip } from './Tooltip'

export type RecurrencePanelProps = {
  readonly templates: readonly PostSummary[]
  readonly renderDateTimeInput?: RenderDateTimeInput | undefined
  readonly renderSelect?: RenderSelect | undefined
}

function defaultStart(): string {
  const next = new Date(Date.now() + 24 * 60 * 60 * 1000)
  next.setMinutes(0, 0, 0)
  return toDateTimeLocalValue(next.toISOString())
}

function CreateRecurrenceDialog({
  templates,
  renderDateTimeInput,
  renderSelect,
  onClose,
  onCreated,
}: RecurrencePanelProps & { readonly onClose: () => void; readonly onCreated: () => void }) {
  const api = useContentAdminApi()
  const { messages } = useContentText()
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(RECURRENCE_FREQUENCY.WEEKLY)
  const [startsAt, setStartsAt] = useState(defaultStart)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const ids = { template: useId(), frequency: useId(), start: useId() }

  async function submit(): Promise<void> {
    const iso = fromDateTimeLocalValue(startsAt)
    if (!api.createRecurrence || !iso || !templateId) return
    setIsBusy(true)
    try {
      await api.createRecurrence({ templateId, frequency, startsAt: iso })
      onCreated()
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : messages.actionError)
      setIsBusy(false)
    }
  }

  return (
    <ActionDialog
      title={messages.recurrenceNew}
      confirmLabel={messages.recurrenceCreate}
      confirmIcon={<Repeat aria-hidden="true" className="adc-icon" />}
      isBusy={isBusy}
      error={error}
      onClose={onClose}
      onConfirm={() => void submit()}
    >
      <SelectField
        id={ids.template}
        label={messages.recurrenceTemplate}
        value={templateId}
        options={templates.map((template) => ({ id: template.id, label: template.title }))}
        onChange={setTemplateId}
        renderSelect={renderSelect}
      />
      <SelectField
        id={ids.frequency}
        label={messages.recurrenceFrequency}
        value={frequency}
        options={[
          { id: RECURRENCE_FREQUENCY.WEEKLY, label: messages.frequencyWeekly },
          { id: RECURRENCE_FREQUENCY.MONTHLY, label: messages.frequencyMonthly },
        ]}
        onChange={(value) => setFrequency(value as RecurrenceFrequency)}
        renderSelect={renderSelect}
      />
      <DateTimeField
        id={ids.start}
        label={messages.recurrenceStart}
        value={startsAt}
        onChange={setStartsAt}
        renderDateTimeInput={renderDateTimeInput}
      />
      <p className="adc-hint">{messages.recurrenceHint}</p>
    </ActionDialog>
  )
}

function RuleRow({ rule, onChanged }: { readonly rule: RecurrenceRule; readonly onChanged: () => void }) {
  const api = useContentAdminApi()
  const { messages, locale, format } = useContentText()
  const toggleLabel = rule.isActive ? messages.recurrencePause : messages.recurrenceResume
  const ToggleIcon = rule.isActive ? CirclePause : CirclePlay
  const StateIcon = rule.isActive ? CirclePlay : CirclePause

  async function toggle(): Promise<void> {
    await api.updateRecurrence?.(rule.id, { isActive: !rule.isActive })
    onChanged()
  }
  async function remove(): Promise<void> {
    await api.removeRecurrence?.(rule.id)
    onChanged()
  }

  return (
    <li className="adc-rule">
      <div className="adc-rule__main">
        <strong>{rule.templateTitle}</strong>
        <span className="adc-muted">
          {rule.frequency === RECURRENCE_FREQUENCY.WEEKLY ? messages.frequencyWeekly : messages.frequencyMonthly}
          {rule.isActive && ` · ${format('recurrenceNext', { date: formatPostDate(rule.nextRunAt, locale, true) })}`}
        </span>
      </div>
      <span className={`adc-chip adc-badge adc-chip--${rule.isActive ? 'published' : 'draft'}`}>
        <StateIcon aria-hidden="true" className="adc-icon" />
        {rule.isActive ? messages.recurrenceActive : messages.recurrencePaused}
      </span>
      <Tooltip text={toggleLabel}>
        <button
          type="button"
          className="adc-button adc-button--ghost adc-button--icon"
          aria-label={toggleLabel}
          onClick={() => void toggle()}
        >
          <ToggleIcon aria-hidden="true" className="adc-icon" />
        </button>
      </Tooltip>
      <Tooltip text={messages.recurrenceRemoveTip}>
        <button
          type="button"
          className="adc-button adc-button--ghost adc-button--icon adc-button--danger"
          aria-label={messages.recurrenceRemove}
          onClick={() => void remove()}
        >
          <Trash2 aria-hidden="true" className="adc-icon" />
        </button>
      </Tooltip>
    </li>
  )
}

export function RecurrencePanel(props: RecurrencePanelProps): ReactNode {
  const api = useContentAdminApi()
  const { messages } = useContentText()
  const [isCreating, setIsCreating] = useState(false)
  const rules = useAsyncResource(
    () => (api.listRecurrences ? api.listRecurrences() : Promise.resolve([])),
    'recurrences',
  )
  if (!api.listRecurrences) return null

  return (
    <section className="adc-recurrence" aria-labelledby="adc-recurrence-title">
      <header className="adc-toolbar">
        <h3 id="adc-recurrence-title" className="adc-subtitle">
          <Repeat aria-hidden="true" className="adc-icon" /> {messages.recurrenceTitle}
        </h3>
        <button
          type="button"
          className="adc-button"
          disabled={props.templates.length === 0}
          onClick={() => setIsCreating(true)}
        >
          <Plus aria-hidden="true" className="adc-icon" />
          {messages.recurrenceNew}
        </button>
      </header>
      {(rules.data?.length ?? 0) === 0 ? (
        <p className="adc-state">
          {props.templates.length === 0 ? messages.recurrenceNeedsTemplate : messages.recurrenceEmpty}
        </p>
      ) : (
        <ul className="adc-rule-list">
          {rules.data?.map((rule) => (
            <RuleRow key={rule.id} rule={rule} onChanged={rules.reload} />
          ))}
        </ul>
      )}
      {isCreating && (
        <CreateRecurrenceDialog
          {...props}
          onClose={() => setIsCreating(false)}
          onCreated={() => {
            setIsCreating(false)
            rules.reload()
          }}
        />
      )}
    </section>
  )
}
