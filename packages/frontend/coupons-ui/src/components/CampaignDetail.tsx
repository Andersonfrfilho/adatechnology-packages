/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { campaignState, type Campaign } from '@adatechnology/coupon-contracts'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { useAsyncResource } from '../hooks/useAsyncResource'
import { readErrorCode } from '../lib/apiError'
import { useCouponsAdminApi, useCouponsText } from '../providers/CouponsProvider'
import { CampaignEditor } from './CampaignEditor'
import { CodesPanel } from './CodesPanel'
import { LeadsPanel } from './LeadsPanel'
import { RedemptionsPanel } from './RedemptionsPanel'
import { ReportPanel } from './ReportPanel'
import { StateChip } from './StateChip'

export const CAMPAIGN_TAB = {
  SETTINGS: 'settings',
  CODES: 'codes',
  LEADS: 'leads',
  REDEMPTIONS: 'redemptions',
  REPORT: 'report',
} as const
export type CampaignTab = (typeof CAMPAIGN_TAB)[keyof typeof CAMPAIGN_TAB]

export type CampaignDetailProps = {
  readonly campaign: Campaign
  readonly onBack: () => void
  readonly onSaved: (campaign: Campaign) => void
  readonly onRemoved: () => void
}

/** Abas por capacidade: método ausente na API = aba ausente. */
export function CampaignDetail({ campaign, onBack, onSaved, onRemoved }: CampaignDetailProps) {
  const api = useCouponsAdminApi()
  const { messages } = useCouponsText()
  const [tab, setTab] = useState<CampaignTab>(CAMPAIGN_TAB.SETTINGS)
  const [removeError, setRemoveError] = useState<string>()
  const getReport = api.getReport
  const report = useAsyncResource(
    () => (getReport ? getReport(campaign.id) : Promise.resolve(undefined)),
    `report-${campaign.id}-${tab}`,
  )
  const tabs = [
    { id: CAMPAIGN_TAB.SETTINGS, label: messages.tabSettings, isAvailable: true },
    { id: CAMPAIGN_TAB.CODES, label: messages.tabCodes, isAvailable: Boolean(api.listCoupons) },
    { id: CAMPAIGN_TAB.LEADS, label: messages.tabLeads, isAvailable: Boolean(api.listLeads) },
    { id: CAMPAIGN_TAB.REDEMPTIONS, label: messages.tabRedemptions, isAvailable: Boolean(api.listRedemptions) },
    { id: CAMPAIGN_TAB.REPORT, label: messages.tabReport, isAvailable: Boolean(api.getReport) },
  ].filter((item) => item.isAvailable)

  async function handleRemove(): Promise<void> {
    if (!api.removeCampaign || (typeof window !== 'undefined' && !window.confirm(messages.removeConfirm))) return
    try {
      await api.removeCampaign(campaign.id)
      onRemoved()
    } catch (error) {
      setRemoveError(readErrorCode(error) === 'COUPON_CAMPAIGN_IN_USE' ? messages.removeInUse : messages.saveError)
    }
  }

  return (
    <section className="acp-root acp-detail" aria-labelledby="acp-detail-title">
      <header className="acp-detail-head">
        <button type="button" className="acp-button acp-button--ghost" onClick={onBack}>
          <ArrowLeft aria-hidden="true" className="acp-icon" />
          <span>{messages.back}</span>
        </button>
        <h2 id="acp-detail-title" className="acp-title">
          {campaign.name}
        </h2>
        <StateChip state={campaignState(campaign, new Date())} />
        {api.removeCampaign ? (
          <button type="button" className="acp-button acp-button--danger" onClick={() => void handleRemove()}>
            <Trash2 aria-hidden="true" className="acp-icon" />
            <span>{messages.remove}</span>
          </button>
        ) : null}
      </header>
      {removeError ? (
        <p className="acp-error" role="alert">
          {removeError}
        </p>
      ) : null}
      <div className="acp-tabs" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`acp-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`acp-panel-${item.id}`}
            className="acp-tab"
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`acp-panel-${tab}`} aria-labelledby={`acp-tab-${tab}`}>
        {tab === CAMPAIGN_TAB.SETTINGS ? (
          <CampaignEditor key={campaign.updatedAt} campaign={campaign} onSaved={onSaved} />
        ) : null}
        {tab === CAMPAIGN_TAB.CODES ? <CodesPanel campaign={campaign} /> : null}
        {tab === CAMPAIGN_TAB.LEADS ? <LeadsPanel campaign={campaign} /> : null}
        {tab === CAMPAIGN_TAB.REDEMPTIONS ? <RedemptionsPanel campaign={campaign} /> : null}
        {tab === CAMPAIGN_TAB.REPORT && report.data ? <ReportPanel report={report.data} /> : null}
      </div>
    </section>
  )
}
