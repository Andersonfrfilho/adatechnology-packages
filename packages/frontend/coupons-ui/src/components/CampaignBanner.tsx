/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PublicCampaign } from '@adatechnology/coupon-contracts'
import { Sparkles } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { useAsyncResource } from '../hooks/useAsyncResource'
import { formatDateTime, formatDiscount } from '../lib/format'
import { useCouponsPublicApi, useCouponsText } from '../providers/CouponsProvider'
import { LeadCaptureDialog } from './LeadCaptureDialog'

export type CampaignBannerProps = {
  /** Campanha a mostrar. Ausente: a primeira de `publicApi.listOpenCampaigns`. */
  readonly campaign?: PublicCampaign
  readonly privacyNote?: ReactNode
}

/** Faixa da campanha no site. Sem campanha no ar, não desenha nada. */
export function CampaignBanner({ campaign: given, privacyNote }: CampaignBannerProps) {
  const api = useCouponsPublicApi()
  const { messages, format, locale, currency, timeZone } = useCouponsText()
  const [isOpen, setIsOpen] = useState(false)
  const listOpen = api.listOpenCampaigns
  const loaded = useAsyncResource(
    () => (given || !listOpen ? Promise.resolve(undefined) : listOpen()),
    given ? 'given' : 'open',
  )
  const campaign = given ?? loaded.data?.[0]
  if (!campaign) return null
  const canCapture = campaign.leadCapture.enabled && Boolean(api.captureLead)

  return (
    <aside className="acp-root acp-banner" aria-label={campaign.title}>
      <Sparkles aria-hidden="true" className="acp-icon acp-banner-icon" />
      <div className="acp-banner-body">
        <strong className="acp-banner-title">{campaign.title}</strong>
        <span className="acp-banner-discount">
          {format('bannerDiscount', { discount: formatDiscount(campaign.discount, locale, currency) })}
        </span>
        {campaign.text ? <p className="acp-banner-text">{campaign.text}</p> : null}
        {campaign.isAutomatic ? <p className="acp-hint">{messages.bannerAutomatic}</p> : null}
        {campaign.endsAt ? (
          <p className="acp-hint">
            {format('bannerEndsAt', { date: formatDateTime(campaign.endsAt, locale, timeZone) })}
          </p>
        ) : null}
      </div>
      {canCapture ? (
        <button type="button" className="acp-button" onClick={() => setIsOpen(true)}>
          {messages.bannerCta}
        </button>
      ) : null}
      {isOpen ? (
        <LeadCaptureDialog
          campaign={campaign}
          onClose={() => setIsOpen(false)}
          {...(privacyNote ? { privacyNote } : {})}
        />
      ) : null}
    </aside>
  )
}
