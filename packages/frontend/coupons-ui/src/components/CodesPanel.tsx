/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Campaign, Coupon } from '@adatechnology/coupon-contracts'
import { useState, type FormEvent } from 'react'

import { useRecordList } from '../hooks/useRecordList'
import { formatDateTime } from '../lib/format'
import { useCouponsAdminApi, useCouponsText } from '../providers/CouponsProvider'
import { IntegerControl, TextControl, ToggleControl } from './formControls'
import { RecordsPanel, type RecordColumn } from './RecordsPanel'

/** Códigos da campanha; no modo lote, gera mais e filtra os ainda não entregues. */
export function CodesPanel({ campaign }: { readonly campaign: Campaign }) {
  const api = useCouponsAdminApi()
  const { messages, format, locale } = useCouponsText()
  const [onlyUnassigned, setOnlyUnassigned] = useState(false)
  const [count, setCount] = useState('100')
  const [prefix, setPrefix] = useState(campaign.codePrefix ?? '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [status, setStatus] = useState<string>()
  const [version, setVersion] = useState(0)
  const listCoupons = api.listCoupons
  const list = useRecordList<Coupon>({
    key: `codes-${campaign.id}-${version}`,
    extraKey: String(onlyUnassigned),
    load: (query) =>
      listCoupons
        ? listCoupons(campaign.id, { ...query, ...(onlyUnassigned ? { unassigned: true } : {}) })
        : Promise.reject(new Error('listCoupons')),
  })

  async function handleGenerate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!api.generateCodes || !count) return
    setIsGenerating(true)
    try {
      const result = await api.generateCodes(campaign.id, { count: Number(count), ...(prefix ? { prefix } : {}) })
      setStatus(format('generatedCount', { count: result.generated }))
      setVersion((value) => value + 1)
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleToggle(coupon: Coupon): Promise<void> {
    await api.setCouponStatus?.(campaign.id, coupon.id, coupon.status === 'active' ? 'disabled' : 'active')
    list.records.reload()
  }

  const columns: RecordColumn<Coupon>[] = [
    {
      key: 'createdAt',
      label: messages.columnCreatedAt,
      render: (coupon) => formatDateTime(coupon.createdAt, locale),
      cell: (coupon) => coupon.createdAt,
    },
    {
      key: 'code',
      label: messages.columnCode,
      render: (coupon) => <span className="acp-code">{coupon.code}</span>,
      cell: (coupon) => coupon.code,
    },
    {
      key: 'status',
      label: messages.columnStatus,
      render: (coupon) => (coupon.status === 'active' ? messages.couponActive : messages.couponDisabled),
      cell: (coupon) => coupon.status,
    },
    {
      key: 'used',
      label: messages.columnUsedCount,
      render: (coupon) => coupon.usedCount,
      cell: (coupon) => coupon.usedCount,
      isNumber: true,
    },
    {
      key: 'delivered',
      label: messages.columnDelivered,
      render: (coupon) => (coupon.leadId ? messages.yes : messages.no),
      cell: (coupon) => (coupon.leadId ? messages.yes : messages.no),
    },
  ]

  const generator =
    campaign.codeMode === 'batch' && api.generateCodes ? (
      <form className="acp-inline-form" onSubmit={(event) => void handleGenerate(event)}>
        <IntegerControl id="acp-generate-count" label={messages.generateCount} value={count} onChange={setCount} />
        <TextControl
          id="acp-generate-prefix"
          label={messages.fieldCodePrefix}
          value={prefix}
          maxLength={12}
          isUpperCase
          onChange={setPrefix}
        />
        <button type="submit" className="acp-button" disabled={isGenerating} aria-busy={isGenerating}>
          {isGenerating ? messages.generating : messages.generateCodes}
        </button>
        {status ? (
          <p role="status" className="acp-status">
            {status}
          </p>
        ) : null}
      </form>
    ) : null

  return (
    <RecordsPanel
      id="acp-codes"
      campaignId={campaign.id}
      exportKind="coupons"
      list={list}
      columns={columns}
      searchPlaceholder={messages.searchRecordsPlaceholder}
      above={generator}
      exportFilters={onlyUnassigned ? { unassigned: true } : {}}
      {...(campaign.codeMode === 'batch'
        ? {
            filters: (
              <ToggleControl
                id="acp-codes-unassigned"
                label={messages.onlyUnassigned}
                checked={onlyUnassigned}
                onChange={setOnlyUnassigned}
              />
            ),
          }
        : {})}
      {...(api.setCouponStatus
        ? {
            rowActions: (coupon: Coupon) => (
              <button type="button" className="acp-button acp-button--ghost" onClick={() => void handleToggle(coupon)}>
                {coupon.status === 'active' ? messages.disableCode : messages.enableCode}
              </button>
            ),
          }
        : {})}
    />
  )
}
