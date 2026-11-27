/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Campaign, Lead } from '@adatechnology/coupon-contracts'

import { useRecordList } from '../hooks/useRecordList'
import { formatDateTime, formatPhone } from '../lib/format'
import { useCouponsAdminApi, useCouponsText } from '../providers/CouponsProvider'
import { RecordsPanel, type RecordColumn } from './RecordsPanel'

export function LeadsPanel({ campaign }: { readonly campaign: Campaign }) {
  const api = useCouponsAdminApi()
  const { messages, locale, timeZone } = useCouponsText()
  const listLeads = api.listLeads
  const list = useRecordList<Lead>({
    key: `leads-${campaign.id}`,
    load: (query) => (listLeads ? listLeads(campaign.id, query) : Promise.reject(new Error('listLeads'))),
  })
  const columns: RecordColumn<Lead>[] = [
    {
      key: 'createdAt',
      label: messages.columnDate,
      render: (lead) => formatDateTime(lead.createdAt, locale, timeZone),
      cell: (lead) => lead.createdAt,
    },
    { key: 'name', label: messages.columnLeadName, render: (lead) => lead.name ?? '', cell: (lead) => lead.name },
    {
      key: 'phone',
      label: messages.columnPhone,
      render: (lead) => formatPhone(lead.phone),
      cell: (lead) => lead.phone,
    },
    { key: 'email', label: messages.columnEmail, render: (lead) => lead.email ?? '', cell: (lead) => lead.email },
    {
      key: 'code',
      label: messages.columnCode,
      render: (lead) => (lead.couponCode ? <span className="acp-code">{lead.couponCode}</span> : null),
      cell: (lead) => lead.couponCode,
    },
  ]
  return (
    <RecordsPanel
      id="acp-leads"
      campaignId={campaign.id}
      exportKind="leads"
      list={list}
      columns={columns}
      searchPlaceholder={messages.searchLeadsPlaceholder}
    />
  )
}
