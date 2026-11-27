/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  canonicalEmail,
  canonicalPhone,
  type CaptureLeadResult,
  type FieldIssue,
  type PublicCampaign,
} from '@adatechnology/coupon-contracts'
import { useState } from 'react'

import { readFieldIssues } from '../lib/apiError'
import { useCouponsPublicApi, useCouponsText } from '../providers/CouponsProvider'

export type LeadFormValues = {
  readonly name: string
  readonly phone: string
  readonly email: string
  readonly consent: boolean
}

const EMPTY_VALUES: LeadFormValues = { name: '', phone: '', email: '', consent: false }

/** Mesma regra do servidor, antes de enviar: obrigatório, formato e aceite — todos de uma vez. */
export function validateLeadForm(
  campaign: PublicCampaign,
  values: LeadFormValues,
  messages: { required: string; invalid: string; consent: string },
): FieldIssue[] {
  const { fields } = campaign.leadCapture
  const issues: FieldIssue[] = []
  if (fields.name === 'required' && !values.name.trim()) issues.push({ field: 'name', message: messages.required })
  const checks = [
    ['phone', fields.phone, values.phone, (raw: string) => canonicalPhone(raw)],
    ['email', fields.email, values.email, canonicalEmail],
  ] as const
  for (const [field, requirement, value, canonical] of checks) {
    if (requirement === 'off') continue
    if (!value.trim()) {
      if (requirement === 'required') issues.push({ field, message: messages.required })
      continue
    }
    if (canonical(value) === undefined) issues.push({ field, message: messages.invalid })
  }
  if (!values.consent) issues.push({ field: 'consent', message: messages.consent })
  return issues
}

export function useLeadCapture(campaign: PublicCampaign) {
  const api = useCouponsPublicApi()
  const { messages } = useCouponsText()
  const [values, setValues] = useState<LeadFormValues>(EMPTY_VALUES)
  const [issues, setIssues] = useState<readonly FieldIssue[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitFailed, setSubmitFailed] = useState(false)
  const [result, setResult] = useState<CaptureLeadResult>()

  function setField<TKey extends keyof LeadFormValues>(key: TKey, value: LeadFormValues[TKey]): void {
    setValues((current) => ({ ...current, [key]: value }))
    setIssues((current) => current.filter((issue) => issue.field !== key))
  }

  async function submit(): Promise<void> {
    const found = validateLeadForm(campaign, values, {
      required: messages.leadFieldRequired,
      invalid: messages.leadFieldInvalid,
      consent: messages.leadConsentRequired,
    })
    setIssues(found)
    setSubmitFailed(false)
    if (found.length > 0 || !api.captureLead) return
    setIsSubmitting(true)
    try {
      setResult(
        await api.captureLead(campaign.id, {
          consent: values.consent,
          ...(values.name.trim() ? { name: values.name.trim() } : {}),
          ...(values.phone.trim() ? { phone: values.phone } : {}),
          ...(values.email.trim() ? { email: values.email.trim() } : {}),
        }),
      )
    } catch (error) {
      setIssues(readFieldIssues(error))
      setSubmitFailed(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return { values, issues, isSubmitting, submitFailed, result, setField, submit }
}
