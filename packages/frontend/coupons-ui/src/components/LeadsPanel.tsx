/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Campaign, Lead } from '@adatechnology/coupon-contracts'
import { useState } from 'react'

import { useRecordList } from '../hooks/useRecordList'
import { dayRangeToInstants, formatDateTime, formatPhone } from '../lib/format'
import { useCouponsAdminApi, useCouponsText } from '../providers/CouponsProvider'
import type { DateRangeValue } from '../providers/types'
import { DateRangeField } from './DateRangeField'
import { RecordsPanel, type RecordColumn } from './RecordsPanel'

const EMPTY_RANGE: DateRangeValue = { from: '', to: '' }

export function LeadsPanel({ campaign }: { readonly campaign: Campaign }) {
  const api = useCouponsAdminApi()
  const { messages, locale, timeZone } = useCouponsText()
  const [range, setRange] = useState<DateRangeValue>(EMPTY_RANGE)
  // Período invertido não filtra (o campo mostra o erro): nunca uma lista vazia sem explicação.
  const period = range.from && range.to && range.from > range.to ? {} : dayRangeToInstants(range, timeZone)
  const listLeads = api.listLeads
  const list = useRecordList<Lead>({
    key: `leads-${campaign.id}`,
    extraKey: JSON.stringify(period),
    load: (query) =>
      listLeads ? listLeads(campaign.id, { ...query, ...period }) : Promise.reject(new Error('listLeads')),
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
      exportFilters={period}
      filters={<DateRangeField id="acp-leads-period" label={messages.filterPeriod} value={range} onChange={setRange} />}
    />
  )
}
