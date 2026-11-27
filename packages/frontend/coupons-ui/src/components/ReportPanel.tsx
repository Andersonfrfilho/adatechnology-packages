/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { CampaignReport } from '@adatechnology/coupon-contracts'

import { formatCents } from '../lib/format'
import { useCouponsText } from '../providers/CouponsProvider'

/** Números da campanha em cartões; o relatório chega pronto (`getReport`). */
export function ReportPanel({ report }: { readonly report: CampaignReport }) {
  const { messages, format, locale, currency } = useCouponsText()
  const cards = [
    [messages.reportUses, String(report.redemptionCount)],
    [messages.reportReleased, String(report.releasedCount)],
    [messages.reportDiscount, formatCents(report.discountCents, locale, currency)],
    [messages.reportSubtotal, formatCents(report.subtotalCents, locale, currency)],
    [messages.reportLeads, String(report.leadCount)],
    [messages.reportCodes, format('reportCodesOf', { used: report.usedCouponCount, total: report.couponCount })],
  ] as const
  return (
    <dl className="acp-report">
      {cards.map(([label, value]) => (
        <div key={label} className="acp-report-card">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
