/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Campos do painel de nó que o runner de fluxo do módulo interpreta: validação da resposta,
 * tentativas, mensagem de nova tentativa, palavras de pular, descrição/seção das opções e o
 * provedor da escolha dinâmica. Separado do `FlowNodePanel` para o painel continuar legível.
 */

import type { ReactNode } from 'react'
import type { FlowAnswerValidation, FlowNodeData } from './flowGraph'
import { OPTIONAL_RUNNER_FIELD_LABEL_DEFAULTS, type FlowRunnerFieldLabels } from './labels'
import { FlowKeywordRoutesField } from './FlowKeywordRoutesField'
import { PANEL_FIELD_CLASSNAME, PANEL_HINT_CLASSNAME, PANEL_LABEL_CLASSNAME } from './flowPanelStyles'

export type FlowRunnerFieldsProps = {
  draft: FlowNodeData
  onDraftChange: (update: (previous: FlowNodeData) => FlowNodeData) => void
  renderTargetOptions: () => ReactNode
  knownContextKeys: readonly string[]
  labels: FlowRunnerFieldLabels
}

function toNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function withValidation(node: FlowNodeData, patch: Partial<FlowAnswerValidation>): FlowNodeData {
  const merged: FlowAnswerValidation = { ...node.validation, ...patch }
  const cleaned = Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined && value !== ''))
  return { ...node, validation: Object.keys(cleaned).length > 0 ? (cleaned as FlowAnswerValidation) : undefined }
}

function NumberField(props: {
  label: string
  value: number | undefined
  onValueChange: (value: number | undefined) => void
}) {
  return (
    <div className="flex-1">
      <label className={PANEL_LABEL_CLASSNAME}>{props.label}</label>
      <input
        type="number"
        value={props.value ?? ''}
        onChange={(event) => props.onValueChange(toNumber(event.target.value))}
        className={`w-full mt-1 ${PANEL_FIELD_CLASSNAME}`}
      />
    </div>
  )
}

function ContextKeyField(props: {
  label: string
  hint?: string
  value: string | undefined
  knownContextKeys: readonly string[]
  onValueChange: (value: string | undefined) => void
}) {
  return (
    <div>
      <label className={PANEL_LABEL_CLASSNAME}>{props.label}</label>
      <input
        value={props.value ?? ''}
        list="runner-context-keys"
        onChange={(event) => props.onValueChange(event.target.value || undefined)}
        className={`w-full mt-1 ${PANEL_FIELD_CLASSNAME}`}
      />
      <datalist id="runner-context-keys">
        {props.knownContextKeys.map((key) => (
          <option key={key} value={key} />
        ))}
      </datalist>
      {props.hint && <p className={PANEL_HINT_CLASSNAME}>{props.hint}</p>}
    </div>
  )
}

function TimeValidationFields({ draft, onDraftChange, knownContextKeys, labels }: FlowRunnerFieldsProps) {
  const validation = draft.validation ?? {}
  const update = (patch: Partial<FlowAnswerValidation>) => onDraftChange((previous) => withValidation(previous, patch))
  const defaults = OPTIONAL_RUNNER_FIELD_LABEL_DEFAULTS
  const timeInput = (label: string, value: string | undefined, onValueChange: (value: string | undefined) => void) => (
    <div className="flex-1">
      <label className={PANEL_LABEL_CLASSNAME}>{label}</label>
      <input
        type="time"
        value={value ?? ''}
        onChange={(event) => onValueChange(event.target.value || undefined)}
        className={`w-full mt-1 ${PANEL_FIELD_CLASSNAME}`}
      />
    </div>
  )

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {timeInput(labels.minTime ?? defaults.minTime, validation.minTime, (minTime) => update({ minTime }))}
        {timeInput(labels.maxTime ?? defaults.maxTime, validation.maxTime, (maxTime) => update({ maxTime }))}
      </div>
      <ContextKeyField
        label={labels.timeWindowsContextKey ?? defaults.timeWindowsContextKey}
        hint={labels.timeWindowsContextKeyHint ?? defaults.timeWindowsContextKeyHint}
        value={validation.windowsContextKey}
        knownContextKeys={knownContextKeys}
        onValueChange={(windowsContextKey) => update({ windowsContextKey })}
      />
    </div>
  )
}

function ValidationFields(props: FlowRunnerFieldsProps) {
  const { draft, onDraftChange, knownContextKeys, labels } = props
  const validation = draft.validation ?? {}
  const update = (patch: Partial<FlowAnswerValidation>) => onDraftChange((previous) => withValidation(previous, patch))

  if (draft.questionType === 'date') {
    return (
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={validation.minDate === 'today'}
            onChange={(event) => update({ minDate: event.target.checked ? 'today' : undefined })}
          />
          {labels.minDateToday}
        </label>
        <ContextKeyField
          label={labels.afterContextKey}
          value={validation.afterContextKey}
          knownContextKeys={knownContextKeys}
          onValueChange={(afterContextKey) => update({ afterContextKey })}
        />
      </div>
    )
  }

  if (draft.questionType === 'time') return <TimeValidationFields {...props} />

  if (draft.questionType === 'int' || draft.questionType === 'money') {
    return (
      <div className="flex gap-2">
        <NumberField label={labels.minValue} value={validation.min} onValueChange={(min) => update({ min })} />
        <NumberField label={labels.maxValue} value={validation.max} onValueChange={(max) => update({ max })} />
      </div>
    )
  }

  if (!draft.questionType || draft.questionType === 'text') {
    return (
      <div className="flex gap-2">
        <NumberField
          label={labels.minLength}
          value={validation.minLength}
          onValueChange={(minLength) => update({ minLength })}
        />
        <NumberField
          label={labels.maxLength}
          value={validation.maxLength}
          onValueChange={(maxLength) => update({ maxLength })}
        />
      </div>
    )
  }

  return null
}

function OptionDetailsField({ draft, onDraftChange, labels }: FlowRunnerFieldsProps) {
  const options = draft.options ?? []
  if (options.length === 0) return null

  function updateDetail(optionId: string, field: 'description' | 'section', value: string) {
    onDraftChange((previous) => {
      const current = previous.optionDetails?.[optionId] ?? {}
      const detail = { ...current, [field]: value || undefined }
      return { ...previous, optionDetails: { ...previous.optionDetails, [optionId]: detail } }
    })
  }

  return (
    <div className="space-y-2">
      {options.map(([optionId, title]) => (
        <div key={optionId} className="space-y-1">
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{title || optionId}</span>
          <div className="flex gap-2">
            <input
              value={draft.optionDetails?.[optionId]?.description ?? ''}
              placeholder={labels.optionDescription}
              aria-label={`${labels.optionDescription}: ${title}`}
              onChange={(event) => updateDetail(optionId, 'description', event.target.value)}
              className={`flex-1 ${PANEL_FIELD_CLASSNAME}`}
            />
            <input
              value={draft.optionDetails?.[optionId]?.section ?? ''}
              placeholder={labels.optionSection}
              aria-label={`${labels.optionSection}: ${title}`}
              onChange={(event) => updateDetail(optionId, 'section', event.target.value)}
              className={`w-24 ${PANEL_FIELD_CLASSNAME}`}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function TextField(props: {
  label: string
  value: string
  hint?: string
  placeholder?: string
  onValueChange: (value: string) => void
}) {
  return (
    <div>
      <label className={PANEL_LABEL_CLASSNAME}>{props.label}</label>
      <input
        value={props.value}
        placeholder={props.placeholder}
        onChange={(event) => props.onValueChange(event.target.value)}
        className={`w-full mt-1 ${PANEL_FIELD_CLASSNAME}`}
      />
      {props.hint && <p className={PANEL_HINT_CLASSNAME}>{props.hint}</p>}
    </div>
  )
}

export function FlowRunnerFields(props: FlowRunnerFieldsProps) {
  const { draft, onDraftChange, labels } = props
  const isDynamic = draft.type === 'dynamic_choice'
  const isChoice = draft.type === 'menu' || draft.questionType === 'choice'
  const isQuestion = draft.type === 'question' && !isChoice

  return (
    <div className="pt-2 border-t border-gray-100 dark:border-gray-700 space-y-3">
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{labels.section}</p>
      <p className={PANEL_HINT_CLASSNAME}>{labels.placeholdersHint}</p>

      {isDynamic && (
        <>
          <TextField
            label={labels.choiceProvider}
            hint={labels.choiceProviderHint}
            value={draft.choiceProvider ?? ''}
            onValueChange={(value) =>
              onDraftChange((previous) => ({ ...previous, choiceProvider: value || undefined }))
            }
          />
          <TextField
            label={labels.contextKey}
            value={draft.contextKey ?? ''}
            onValueChange={(value) => onDraftChange((previous) => ({ ...previous, contextKey: value || undefined }))}
          />
        </>
      )}

      {isQuestion && <ValidationFields {...props} />}
      {isChoice && <OptionDetailsField {...props} />}
      {isChoice && (
        <div>
          <label className={PANEL_LABEL_CLASSNAME}>{labels.unmatchedChoice}</label>
          <select
            value={draft.unmatchedChoice ?? 'reask'}
            onChange={(event) => {
              const value = event.target.value === 'default' ? 'default' : undefined
              onDraftChange((previous) => ({ ...previous, unmatchedChoice: value }))
            }}
            className={`w-full mt-1 ${PANEL_FIELD_CLASSNAME}`}
          >
            <option value="reask">{labels.unmatchedChoiceReask}</option>
            <option value="default">{labels.unmatchedChoiceDefault}</option>
          </select>
        </div>
      )}
      {(isChoice || isDynamic) && (
        <TextField
          label={labels.listButtonLabel}
          value={draft.listButtonLabel ?? ''}
          onValueChange={(value) => onDraftChange((previous) => ({ ...previous, listButtonLabel: value || undefined }))}
        />
      )}
      {isQuestion && (
        <TextField
          label={labels.skipKeywords}
          hint={labels.skipKeywordsHint}
          value={(draft.skipKeywords ?? []).join(', ')}
          onValueChange={(value) => {
            const keywords = value
              .split(',')
              .map((keyword) => keyword.trim())
              .filter(Boolean)
            onDraftChange((previous) => ({ ...previous, skipKeywords: keywords.length > 0 ? keywords : undefined }))
          }}
        />
      )}

      <TextField
        label={labels.fallbackMessage}
        placeholder={labels.fallbackPlaceholder}
        value={draft.fallbackMessage ?? ''}
        onValueChange={(value) => onDraftChange((previous) => ({ ...previous, fallbackMessage: value || undefined }))}
      />
      <div>
        <NumberField
          label={labels.maxInvalidAnswers}
          value={draft.maxInvalidAnswers}
          onValueChange={(value) =>
            onDraftChange((previous) => ({
              ...previous,
              maxInvalidAnswers: value && value > 0 ? Math.floor(value) : undefined,
            }))
          }
        />
        <p className={PANEL_HINT_CLASSNAME}>{labels.maxInvalidAnswersHint}</p>
      </div>

      {(draft.type === 'menu' || draft.type === 'question') && <FlowKeywordRoutesField {...props} />}
    </div>
  )
}
