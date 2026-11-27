/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { CodeMode, FieldRequirement, ScopeKind } from '@adatechnology/coupon-contracts'

import type { CampaignEditorState } from '../hooks/useCampaignEditor'
import { useCouponsText } from '../providers/CouponsProvider'
import { IntegerControl, TextAreaControl, TextControl, ToggleControl } from './formControls'
import { fieldControlId } from './IssueSummary'
import { SelectField } from './SelectField'

export const EDITOR_PREFIX = 'acp-campaign'

export type SectionProps = { readonly editor: CampaignEditorState; readonly isNew: boolean }

export const controlId = (field: string) => fieldControlId(EDITOR_PREFIX, field)

export function useIssueFor(editor: CampaignEditorState): (field: string) => string | undefined {
  return (field) => editor.issues.find((issue) => issue.field === field || issue.field.startsWith(`${field}.`))?.message
}

export function CodeSection({ editor, isNew }: SectionProps) {
  const { messages } = useCouponsText()
  const issueFor = useIssueFor(editor)
  const { draft, setField } = editor
  const modes: { id: CodeMode; label: string }[] = [
    { id: 'fixed', label: messages.codeModeFixed },
    { id: 'per-lead', label: messages.codeModePerLead },
    { id: 'batch', label: messages.codeModeBatch },
  ]
  return (
    <fieldset className="acp-section">
      <legend>{messages.sectionCodes}</legend>
      {isNew && !draft.isAutomatic ? (
        <SelectField
          id={controlId('codeMode')}
          label={messages.fieldCodeMode}
          value={draft.codeMode}
          options={modes}
          onChange={(value) => setField('codeMode', value as CodeMode)}
        />
      ) : (
        <p className="acp-hint">
          {messages.fieldCodeMode}: {modes.find((mode) => mode.id === draft.codeMode)?.label} —{' '}
          {messages.codeModeLocked}
        </p>
      )}
      {draft.codeMode === 'fixed' ? (
        <TextControl
          id={controlId('fixedCode')}
          label={messages.fieldFixedCode}
          hint={messages.fieldFixedCodeHint}
          value={draft.fixedCode}
          maxLength={32}
          isUpperCase
          onChange={(value) => setField('fixedCode', value)}
          {...errorProp(issueFor('fixedCode'))}
        />
      ) : (
        <TextControl
          id={controlId('codePrefix')}
          label={messages.fieldCodePrefix}
          value={draft.codePrefix}
          maxLength={12}
          isUpperCase
          onChange={(value) => setField('codePrefix', value)}
          {...errorProp(issueFor('codePrefix'))}
        />
      )}
      <ToggleControl
        id={controlId('isAutomatic')}
        label={messages.fieldIsAutomatic}
        checked={draft.isAutomatic}
        onChange={(value) => setField('isAutomatic', value)}
      />
    </fieldset>
  )
}

export function LimitsSection({ editor }: SectionProps) {
  const { messages } = useCouponsText()
  const issueFor = useIssueFor(editor)
  const { draft, setField } = editor
  const limits = [
    ['usageLimitTotal', messages.fieldUsageLimitTotal],
    ['usageLimitPerCustomer', messages.fieldUsageLimitPerCustomer],
    ['usageLimitPerCode', messages.fieldUsageLimitPerCode],
  ] as const
  return (
    <fieldset className="acp-section">
      <legend>{messages.sectionLimits}</legend>
      <div className="acp-grid">
        {limits.map(([key, label]) => (
          <IntegerControl
            key={key}
            id={controlId(key)}
            label={label}
            hint={messages.fieldOptionalHint}
            value={draft[key]}
            onChange={(value) => setField(key, value)}
            {...errorProp(issueFor(key))}
          />
        ))}
      </div>
    </fieldset>
  )
}

export function ScopeSection({ editor }: SectionProps) {
  const { messages } = useCouponsText()
  const issueFor = useIssueFor(editor)
  const { draft, setField } = editor
  const kinds: { id: ScopeKind; label: string }[] = [
    { id: 'all', label: messages.scopeAll },
    { id: 'products', label: messages.scopeProducts },
    { id: 'categories', label: messages.scopeCategories },
    { id: 'tags', label: messages.scopeTags },
  ]
  return (
    <fieldset className="acp-section">
      <legend>{messages.sectionScope}</legend>
      <SelectField
        id={controlId('scope-kind')}
        label={messages.fieldScopeKind}
        value={draft.scopeKind}
        options={kinds}
        onChange={(value) => setField('scopeKind', value as ScopeKind)}
      />
      {draft.scopeKind === 'all' ? null : (
        <TextAreaControl
          id={controlId('scope')}
          label={messages.fieldScopeValues}
          hint={messages.fieldScopeValuesHint}
          value={draft.scopeValues}
          rows={2}
          onChange={(value) => setField('scopeValues', value)}
          {...errorProp(issueFor('scope'))}
        />
      )}
    </fieldset>
  )
}

export function LeadCaptureSection({ editor }: SectionProps) {
  const { messages } = useCouponsText()
  const issueFor = useIssueFor(editor)
  const { draft, setField } = editor
  const requirements: { id: FieldRequirement; label: string }[] = [
    { id: 'off', label: messages.requirementOff },
    { id: 'optional', label: messages.requirementOptional },
    { id: 'required', label: messages.requirementRequired },
  ]
  const fields = [
    ['name', messages.fieldLeadName],
    ['phone', messages.fieldLeadPhone],
    ['email', messages.fieldLeadEmail],
  ] as const
  const fieldsError = issueFor('leadCapture.fields')
  return (
    <fieldset className="acp-section">
      <legend>{messages.sectionLeadCapture}</legend>
      <ToggleControl
        id={controlId('leadCapture.enabled')}
        label={messages.fieldLeadCaptureEnabled}
        checked={draft.leadCaptureEnabled}
        disabled={draft.isAutomatic}
        onChange={(value) => setField('leadCaptureEnabled', value)}
      />
      {draft.leadCaptureEnabled ? (
        <>
          <div className="acp-grid" data-field={controlId('leadCapture.fields')}>
            {fields.map(([key, label]) => (
              <SelectField
                key={key}
                id={controlId(`leadCapture.fields.${key}`)}
                label={label}
                value={draft.leadFields[key]}
                options={requirements}
                onChange={(value) => setField('leadFields', { ...draft.leadFields, [key]: value as FieldRequirement })}
              />
            ))}
          </div>
          {fieldsError ? (
            <p className="acp-error" role="alert">
              {fieldsError}
            </p>
          ) : null}
          <TextAreaControl
            id={controlId('leadCapture.consentText')}
            label={messages.fieldConsentText}
            value={draft.consentText}
            rows={2}
            onChange={(value) => setField('consentText', value)}
            {...errorProp(issueFor('leadCapture.consentText'))}
          />
        </>
      ) : null}
    </fieldset>
  )
}

export function errorProp(error: string | undefined): { error?: string } {
  return error ? { error } : {}
}
