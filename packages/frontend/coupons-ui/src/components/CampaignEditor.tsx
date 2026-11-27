/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Campaign, DiscountKind } from '@adatechnology/coupon-contracts'
import { Save } from 'lucide-react'
import type { FormEvent } from 'react'

import { useCampaignEditor } from '../hooks/useCampaignEditor'
import { useCouponsText } from '../providers/CouponsProvider'
import {
  CodeSection,
  controlId,
  EDITOR_PREFIX,
  errorProp,
  LeadCaptureSection,
  LimitsSection,
  ScopeSection,
  useIssueFor,
  type SectionProps,
} from './CampaignEditorSections'
import { DateTimeField } from './DateTimeField'
import { IntegerControl, MoneyControl, TextAreaControl, TextControl, ToggleControl } from './formControls'
import { IssueSummary } from './IssueSummary'
import { SelectField } from './SelectField'

export type CampaignEditorProps = {
  /** Ausente: campanha nova. */
  readonly campaign?: Campaign
  readonly onSaved?: (campaign: Campaign) => void
}

function BasicsSection({ editor }: SectionProps) {
  const { messages } = useCouponsText()
  const issueFor = useIssueFor(editor)
  const { draft, setField } = editor
  return (
    <fieldset className="acp-section">
      <legend>{messages.sectionBasics}</legend>
      <TextControl
        id={controlId('name')}
        label={messages.fieldName}
        hint={messages.fieldNameHint}
        value={draft.name}
        maxLength={120}
        onChange={(value) => setField('name', value)}
        {...errorProp(issueFor('name'))}
      />
      <TextControl
        id={controlId('title')}
        label={messages.fieldTitle}
        value={draft.title}
        maxLength={160}
        onChange={(value) => setField('title', value)}
        {...errorProp(issueFor('title'))}
      />
      <TextAreaControl
        id={controlId('text')}
        label={messages.fieldText}
        value={draft.text}
        onChange={(value) => setField('text', value)}
        {...errorProp(issueFor('text'))}
      />
      <TextAreaControl
        id={controlId('terms')}
        label={messages.fieldTerms}
        value={draft.terms}
        onChange={(value) => setField('terms', value)}
        {...errorProp(issueFor('terms'))}
      />
      <ToggleControl
        id={controlId('isActive')}
        label={messages.fieldIsActive}
        checked={draft.isActive}
        onChange={(value) => setField('isActive', value)}
      />
      <div className="acp-grid">
        <DateTimeField
          id={controlId('startsAt')}
          label={messages.fieldStartsAt}
          value={draft.startsAt}
          onChange={(value) => setField('startsAt', value)}
          {...errorProp(issueFor('startsAt'))}
        />
        <DateTimeField
          id={controlId('endsAt')}
          label={messages.fieldEndsAt}
          value={draft.endsAt}
          onChange={(value) => setField('endsAt', value)}
          {...errorProp(issueFor('endsAt'))}
        />
      </div>
    </fieldset>
  )
}

function DiscountSection({ editor }: SectionProps) {
  const { messages } = useCouponsText()
  const issueFor = useIssueFor(editor)
  const { draft, setField } = editor
  const valueError = errorProp(issueFor('discount.value'))
  return (
    <fieldset className="acp-section">
      <legend>{messages.sectionDiscount}</legend>
      <SelectField
        id={controlId('discount-kind')}
        label={messages.fieldDiscountKind}
        value={draft.discountKind}
        options={[
          { id: 'percent', label: messages.discountPercent },
          { id: 'fixed', label: messages.discountFixed },
        ]}
        onChange={(value) => setField('discountKind', value as DiscountKind)}
      />
      <div className="acp-grid">
        {draft.discountKind === 'percent' ? (
          <IntegerControl
            id={controlId('discount.value')}
            label={messages.fieldDiscountPercent}
            value={draft.percent}
            onChange={(value) => setField('percent', value.slice(0, 3))}
            {...valueError}
          />
        ) : (
          <MoneyControl
            id={controlId('discount.value')}
            label={messages.fieldDiscountFixed}
            value={draft.fixedCents}
            onChange={(value) => setField('fixedCents', value)}
            {...valueError}
          />
        )}
        <MoneyControl
          id={controlId('discount.maxDiscountCents')}
          label={messages.fieldMaxDiscount}
          hint={messages.fieldOptionalHint}
          value={draft.maxDiscountCents}
          onChange={(value) => setField('maxDiscountCents', value)}
          {...errorProp(issueFor('discount.maxDiscountCents'))}
        />
        <MoneyControl
          id={controlId('discount.minSubtotalCents')}
          label={messages.fieldMinSubtotal}
          hint={messages.fieldOptionalHint}
          value={draft.minSubtotalCents}
          onChange={(value) => setField('minSubtotalCents', value)}
          {...errorProp(issueFor('discount.minSubtotalCents'))}
        />
      </div>
    </fieldset>
  )
}

/** Editor da campanha só com componentes do pacote (e os do host pelos slots de render). */
export function CampaignEditor({ campaign, onSaved }: CampaignEditorProps) {
  const { messages } = useCouponsText()
  const editor = useCampaignEditor({ ...(campaign ? { campaign } : {}), ...(onSaved ? { onSaved } : {}) })
  const isNew = !campaign

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    void editor.save()
  }

  return (
    <form className="acp-editor" noValidate onSubmit={handleSubmit}>
      <IssueSummary issues={editor.issues} prefix={EDITOR_PREFIX} />
      <BasicsSection editor={editor} isNew={isNew} />
      <DiscountSection editor={editor} isNew={isNew} />
      <CodeSection editor={editor} isNew={isNew} />
      <LimitsSection editor={editor} isNew={isNew} />
      <ScopeSection editor={editor} isNew={isNew} />
      <LeadCaptureSection editor={editor} isNew={isNew} />
      <div className="acp-form-actions">
        {editor.isDirty ? <span className="acp-hint">{messages.unsavedChanges}</span> : null}
        {editor.saveFailed && editor.issues.length === 0 ? (
          <span className="acp-error" role="alert">
            {messages.saveError}
          </span>
        ) : null}
        <button type="submit" className="acp-button" disabled={editor.isSaving} aria-busy={editor.isSaving}>
          <Save aria-hidden="true" className="acp-icon" />
          <span>{editor.isSaving ? messages.saving : messages.save}</span>
        </button>
      </div>
    </form>
  )
}
