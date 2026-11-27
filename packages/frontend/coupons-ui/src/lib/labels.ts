/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { CampaignState, CouponRejection } from '@adatechnology/coupon-contracts'

import type { CouponsMessages } from '../locales'

export const STATE_LABEL_KEY: Record<CampaignState, keyof CouponsMessages> = {
  running: 'stateRunning',
  scheduled: 'stateScheduled',
  ended: 'stateEnded',
  inactive: 'stateInactive',
}

export function rejectionMessage(messages: CouponsMessages, reason: CouponRejection): string {
  const key = `reason_${reason}` as keyof CouponsMessages
  return messages[key] ?? reason
}

/**
 * Caminho da API → rótulo impresso no formulário. Caminho sem rótulo não some do aviso: sai com o
 * nome que a API usou (`web.md` §11).
 */
export const FIELD_LABEL_KEY: Readonly<Record<string, keyof CouponsMessages>> = {
  name: 'fieldName',
  title: 'fieldTitle',
  text: 'fieldText',
  terms: 'fieldTerms',
  startsAt: 'fieldStartsAt',
  endsAt: 'fieldEndsAt',
  'discount.value': 'fieldDiscountPercent',
  'discount.maxDiscountCents': 'fieldMaxDiscount',
  'discount.minSubtotalCents': 'fieldMinSubtotal',
  codeMode: 'fieldCodeMode',
  fixedCode: 'fieldFixedCode',
  codePrefix: 'fieldCodePrefix',
  usageLimitTotal: 'fieldUsageLimitTotal',
  usageLimitPerCustomer: 'fieldUsageLimitPerCustomer',
  usageLimitPerCode: 'fieldUsageLimitPerCode',
  scope: 'fieldScopeValues',
  isAutomatic: 'fieldIsAutomatic',
  'leadCapture.enabled': 'fieldLeadCaptureEnabled',
  'leadCapture.fields': 'fieldLeadPhone',
  'leadCapture.consentText': 'fieldConsentText',
}

export function fieldLabel(messages: CouponsMessages, field: string): string {
  const key =
    FIELD_LABEL_KEY[field] ??
    FIELD_LABEL_KEY[field.split('.').slice(0, 2).join('.')] ??
    FIELD_LABEL_KEY[field.split('.')[0] ?? '']
  return key ? messages[key] : field
}
