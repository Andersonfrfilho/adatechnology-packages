/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Campaign, Redemption, RedemptionStatus } from '@adatechnology/coupon-contracts'
import { useState } from 'react'

import { useRecordList } from '../hooks/useRecordList'
import { formatCents, formatDateTime } from '../lib/format'
import { useCouponsAdminApi, useCouponsText } from '../providers/CouponsProvider'
import { FilterChips } from './FilterChips'
import { RecordsPanel, type RecordColumn } from './RecordsPanel'

export function RedemptionsPanel({ campaign }: { readonly campaign: Campaign }) {
  const api = useCouponsAdminApi()
  const { messages, locale, currency, timeZone } = useCouponsText()
  const [statuses, setStatuses] = useState<RedemptionStatus[]>([])
  const listRedemptions = api.listRedemptions
  const list = useRecordList<Redemption>({
    key: `redemptions-${campaign.id}`,
    extraKey: statuses.join(','),
    load: (query) =>
      listRedemptions
        ? listRedemptions(campaign.id, { ...query, ...(statuses.length ? { statuses } : {}) })
        : Promise.reject(new Error('listRedemptions')),
  })
  const statusLabel = (status: RedemptionStatus) =>
    status === 'redeemed' ? messages.redemptionRedeemed : messages.redemptionReleased
  const columns: RecordColumn<Redemption>[] = [
    {
      key: 'redeemedAt',
      label: messages.columnDate,
      render: (item) => formatDateTime(item.redeemedAt, locale, timeZone),
      cell: (item) => item.redeemedAt,
    },
    {
      key: 'status',
      label: messages.columnStatus,
      render: (item) => statusLabel(item.status),
      cell: (item) => statusLabel(item.status),
    },
    {
      key: 'code',
      label: messages.columnCode,
      render: (item) => (item.couponCode ? <span className="acp-code">{item.couponCode}</span> : null),
      cell: (item) => item.couponCode,
    },
    {
      key: 'order',
      label: messages.columnOrder,
      render: (item) => `${item.orderRef.kind} ${item.orderRef.id}`,
      cell: (item) => `${item.orderRef.kind}:${item.orderRef.id}`,
    },
    {
      key: 'subtotal',
      label: messages.columnSubtotal,
      render: (item) => formatCents(item.subtotalCents, locale, currency),
      cell: (item) => item.subtotalCents / 100,
      isNumber: true,
    },
    {
      key: 'discount',
      label: messages.columnDiscount,
      render: (item) => formatCents(item.discountCents, locale, currency),
      cell: (item) => item.discountCents / 100,
      isNumber: true,
    },
    {
      key: 'releasedAt',
      label: messages.columnReleasedAt,
      render: (item) => formatDateTime(item.releasedAt, locale, timeZone),
      cell: (item) => item.releasedAt,
    },
  ]
  return (
    <RecordsPanel
      id="acp-redemptions"
      campaignId={campaign.id}
      exportKind="redemptions"
      list={list}
      columns={columns}
      searchPlaceholder={messages.searchRecordsPlaceholder}
      exportFilters={statuses.length ? { statuses } : {}}
      filters={
        <FilterChips
          label={messages.columnStatus}
          options={[
            { value: 'redeemed' as const, label: messages.redemptionRedeemed },
            { value: 'released' as const, label: messages.redemptionReleased },
          ]}
          selected={statuses}
          onChange={setStatuses}
        />
      }
    />
  )
}
