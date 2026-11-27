/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Campaign, FieldIssue } from '@adatechnology/coupon-contracts'
import { useState } from 'react'

import { readFieldIssues } from '../lib/apiError'
import {
  draftFromCampaign,
  draftToInput,
  draftToUpdate,
  EMPTY_CAMPAIGN_DRAFT,
  isDraftDirty,
  validateDraft,
  type CampaignDraft,
} from '../lib/campaignDraft'
import { useCouponsAdminApi, useCouponsText } from '../providers/CouponsProvider'

export type CampaignEditorState = {
  readonly draft: CampaignDraft
  readonly issues: readonly FieldIssue[]
  readonly isSaving: boolean
  readonly isDirty: boolean
  readonly saveFailed: boolean
  readonly setField: <TKey extends keyof CampaignDraft>(key: TKey, value: CampaignDraft[TKey]) => void
  readonly save: () => Promise<Campaign | undefined>
}

/** Camada headless do editor: valida com o schema do servidor antes de enviar e ancora a recusa do servidor nos campos. */
export function useCampaignEditor(params: {
  readonly campaign?: Campaign
  readonly onSaved?: (campaign: Campaign) => void
}): CampaignEditorState {
  const api = useCouponsAdminApi()
  const { timeZone } = useCouponsText()
  const [original, setOriginal] = useState<CampaignDraft>(() =>
    params.campaign ? draftFromCampaign(params.campaign, timeZone) : EMPTY_CAMPAIGN_DRAFT,
  )
  const [draft, setDraft] = useState<CampaignDraft>(original)
  const [issues, setIssues] = useState<readonly FieldIssue[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const isNew = !params.campaign

  function setField<TKey extends keyof CampaignDraft>(key: TKey, value: CampaignDraft[TKey]): void {
    setDraft((current) => ({ ...current, [key]: value }))
    // Editar o campo limpa o erro dele.
    setIssues((current) => current.filter((issue) => !issue.field.startsWith(fieldPrefix(key))))
  }

  async function save(): Promise<Campaign | undefined> {
    const found = validateDraft(draft, isNew, timeZone)
    setIssues(found)
    setSaveFailed(false)
    if (found.length > 0) return undefined
    setIsSaving(true)
    try {
      const saved = params.campaign
        ? await api.updateCampaign(params.campaign.id, draftToUpdate(draft, timeZone))
        : await api.createCampaign(draftToInput(draft, timeZone))
      const next = draftFromCampaign(saved, timeZone)
      setOriginal(next)
      setDraft(next)
      params.onSaved?.(saved)
      return saved
    } catch (error) {
      setIssues(readFieldIssues(error))
      setSaveFailed(true)
      return undefined
    } finally {
      setIsSaving(false)
    }
  }

  return { draft, issues, isSaving, isDirty: isDraftDirty(draft, original), saveFailed, setField, save }
}

/** Campo do rascunho → começo do caminho da API que ele alimenta. */
export function fieldPrefix(key: keyof CampaignDraft): string {
  const map: Partial<Record<keyof CampaignDraft, string>> = {
    percent: 'discount',
    fixedCents: 'discount',
    discountKind: 'discount',
    maxDiscountCents: 'discount.maxDiscountCents',
    minSubtotalCents: 'discount.minSubtotalCents',
    scopeKind: 'scope',
    scopeValues: 'scope',
    leadCaptureEnabled: 'leadCapture',
    leadFields: 'leadCapture.fields',
    consentText: 'leadCapture.consentText',
  }
  return map[key] ?? key
}
