/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PublicCampaign } from '@adatechnology/coupon-contracts'
import { Check, Copy, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { useLeadCapture } from '../hooks/useLeadCapture'
import { formatDateTime, formatDiscount, maskPhoneInput } from '../lib/format'
import { useCouponsText } from '../providers/CouponsProvider'
import { Field } from './Field'

export type LeadCaptureDialogProps = {
  readonly campaign: PublicCampaign
  readonly onClose: () => void
  /** Link da política de privacidade do host, abaixo do aceite. */
  readonly privacyNote?: ReactNode
}

/** A pessoa deixa o contato (só os campos que a campanha pede), aceita o uso dos dados e vê o código. */
export function LeadCaptureDialog({ campaign, onClose, privacyNote }: LeadCaptureDialogProps) {
  const { messages, format, locale, currency, timeZone } = useCouponsText()
  const form = useLeadCapture(campaign)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [isCopied, setIsCopied] = useState(false)
  const { fields } = campaign.leadCapture
  const issueFor = (field: string) => form.issues.find((issue) => issue.field === field)?.message
  const discount = formatDiscount(campaign.discount, locale, currency)

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('input, button')?.focus()
    function handleKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    void form.submit()
  }

  async function handleCopy(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code)
      setIsCopied(true)
    } catch {
      setIsCopied(false)
    }
  }

  const contactFields = [
    {
      key: 'name' as const,
      requirement: fields.name,
      label: messages.fieldLeadName,
      type: 'text',
      autoComplete: 'name',
    },
    {
      key: 'phone' as const,
      requirement: fields.phone,
      label: messages.fieldLeadPhone,
      type: 'tel',
      autoComplete: 'tel-national',
    },
    {
      key: 'email' as const,
      requirement: fields.email,
      label: messages.fieldLeadEmail,
      type: 'email',
      autoComplete: 'email',
    },
  ].filter((field) => field.requirement !== 'off')

  const { result } = form
  return (
    <div className="acp-root acp-scrim" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="acp-dialog" role="dialog" aria-modal="true" aria-labelledby="acp-lead-title" ref={dialogRef}>
        <header className="acp-dialog-head">
          <h2 id="acp-lead-title" className="acp-title">
            {campaign.title}
          </h2>
          <button
            type="button"
            className="acp-button acp-button--ghost"
            aria-label={messages.leadDialogClose}
            onClick={onClose}
          >
            <X aria-hidden="true" className="acp-icon" />
          </button>
        </header>
        {result ? (
          <div className="acp-lead-success" role="status">
            <h3>{format('leadSuccessTitle', { discount })}</h3>
            {result.couponCode ? (
              <>
                <p className="acp-coupon-code" data-testid="coupon-code">
                  {result.couponCode}
                </p>
                <button
                  type="button"
                  className="acp-button acp-button--ghost"
                  onClick={() => void handleCopy(result.couponCode ?? '')}
                >
                  <Copy aria-hidden="true" className="acp-icon" />
                  <span>{isCopied ? messages.leadCopied : messages.leadCopy}</span>
                </button>
              </>
            ) : (
              <p>{messages.leadSuccessAgain}</p>
            )}
            {result.endsAt ? (
              <p className="acp-hint">
                {format('leadValidUntil', { date: formatDateTime(result.endsAt, locale, timeZone) })}
              </p>
            ) : null}
            {campaign.terms ? <p className="acp-hint">{campaign.terms}</p> : null}
            <button type="button" className="acp-button" onClick={onClose}>
              <Check aria-hidden="true" className="acp-icon" />
              <span>{messages.leadDone}</span>
            </button>
          </div>
        ) : (
          <form className="acp-lead-form" noValidate onSubmit={handleSubmit}>
            {campaign.text ? <p>{campaign.text}</p> : null}
            {contactFields.map((field) => {
              const error = issueFor(field.key)
              return (
                <Field
                  key={field.key}
                  id={`acp-lead-${field.key}`}
                  label={field.label}
                  {...(field.requirement === 'optional' ? { hint: messages.couponHint } : {})}
                  {...(error ? { error } : {})}
                >
                  {(aria) => (
                    <input
                      {...aria}
                      className="acp-input"
                      id={`acp-lead-${field.key}`}
                      type={field.type}
                      autoComplete={field.autoComplete}
                      {...(field.key === 'phone' ? { inputMode: 'tel' as const } : {})}
                      value={form.values[field.key]}
                      onChange={(event) =>
                        form.setField(
                          field.key,
                          field.key === 'phone' ? maskPhoneInput(event.target.value) : event.target.value,
                        )
                      }
                    />
                  )}
                </Field>
              )
            })}
            <div className={`acp-field${issueFor('consent') ? ' acp-field--invalid' : ''}`}>
              <label className="acp-consent" htmlFor="acp-lead-consent">
                <input
                  id="acp-lead-consent"
                  type="checkbox"
                  checked={form.values.consent}
                  aria-invalid={Boolean(issueFor('consent'))}
                  aria-describedby={issueFor('consent') ? 'acp-lead-consent-error' : undefined}
                  onChange={(event) => form.setField('consent', event.target.checked)}
                />
                <span>{campaign.leadCapture.consentText}</span>
              </label>
              {privacyNote}
              {issueFor('consent') ? (
                <p className="acp-error" id="acp-lead-consent-error" role="alert">
                  {issueFor('consent')}
                </p>
              ) : null}
            </div>
            {form.submitFailed && form.issues.length === 0 ? (
              <p className="acp-error" role="alert">
                {messages.leadError}
              </p>
            ) : null}
            <button type="submit" className="acp-button" disabled={form.isSubmitting} aria-busy={form.isSubmitting}>
              <Check aria-hidden="true" className="acp-icon" />
              <span>{form.isSubmitting ? messages.leadSubmitting : messages.leadSubmit}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
