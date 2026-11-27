/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { campaignState, type CampaignListItem } from '@adatechnology/coupon-contracts'

import { formatCents, formatDateTime, formatDiscount } from '../lib/format'
import type { CampaignListState, CampaignSortKey } from '../lib/listUrlState'
import { useCouponsText } from '../providers/CouponsProvider'
import { SortHeader } from './SortHeader'
import { StateChip } from './StateChip'

export type CampaignTableProps = {
  readonly campaigns: readonly CampaignListItem[]
  readonly state: Pick<CampaignListState, 'sort' | 'order'>
  readonly selectedIds: ReadonlySet<string>
  readonly now: Date
  readonly onToggleSort: (sort: CampaignSortKey) => void
  readonly onToggleSelected: (id: string) => void
  readonly onSelectAll: (ids: ReadonlySet<string>) => void
  readonly onOpen: (campaign: CampaignListItem) => void
}

export function CampaignTable(props: CampaignTableProps) {
  const { messages, format, locale, currency, timeZone } = useCouponsText()
  const allSelected =
    props.campaigns.length > 0 && props.campaigns.every((campaign) => props.selectedIds.has(campaign.id))
  const direction = (sort: CampaignSortKey) => (props.state.sort === sort ? props.state.order : undefined)

  return (
    <div className="acp-table-wrap">
      <table className="acp-table">
        <thead>
          <tr>
            <th scope="col" className="acp-check-cell">
              <input
                type="checkbox"
                aria-label={messages.selectAll}
                checked={allSelected}
                onChange={() =>
                  props.onSelectAll(allSelected ? new Set() : new Set(props.campaigns.map((campaign) => campaign.id)))
                }
              />
            </th>
            <SortHeader
              label={messages.columnName}
              direction={direction('name')}
              onToggle={() => props.onToggleSort('name')}
            />
            <th scope="col">{messages.columnState}</th>
            <th scope="col">{messages.columnDiscount}</th>
            <SortHeader
              label={messages.columnStartsAt}
              direction={direction('startsAt')}
              onToggle={() => props.onToggleSort('startsAt')}
            />
            <SortHeader
              label={messages.columnEndsAt}
              direction={direction('endsAt')}
              onToggle={() => props.onToggleSort('endsAt')}
            />
            <th scope="col" className="acp-number">
              {messages.columnUses}
            </th>
            <th scope="col" className="acp-number">
              {messages.columnDiscountGiven}
            </th>
            <th scope="col" className="acp-number">
              {messages.columnLeads}
            </th>
          </tr>
        </thead>
        <tbody>
          {props.campaigns.map((campaign) => (
            <tr key={campaign.id}>
              <td className="acp-check-cell">
                <input
                  type="checkbox"
                  aria-label={format('selectRow', { name: campaign.name })}
                  checked={props.selectedIds.has(campaign.id)}
                  onChange={() => props.onToggleSelected(campaign.id)}
                />
              </td>
              <td>
                <button type="button" className="acp-link" onClick={() => props.onOpen(campaign)}>
                  {campaign.name}
                </button>
                {campaign.fixedCode ? <span className="acp-code">{campaign.fixedCode}</span> : null}
              </td>
              <td>
                <StateChip state={campaignState(campaign, props.now)} />
              </td>
              <td>{formatDiscount(campaign.discount, locale, currency)}</td>
              <td>{formatDateTime(campaign.startsAt, locale, timeZone)}</td>
              <td>{formatDateTime(campaign.endsAt, locale, timeZone)}</td>
              <td className="acp-number">{campaign.stats.redemptionCount}</td>
              <td className="acp-number">{formatCents(campaign.stats.discountCents, locale, currency)}</td>
              <td className="acp-number">{campaign.stats.leadCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
