/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { campaignState, type CampaignListItem, type SpreadsheetTable } from '@adatechnology/coupon-contracts'

import type { CouponsMessages } from '../locales'
import { STATE_LABEL_KEY } from './labels'

/** Mesmas colunas da tela; dinheiro como número (em reais) para a planilha somar. */
export function buildCampaignTable(params: {
  readonly campaigns: readonly CampaignListItem[]
  readonly messages: CouponsMessages
  readonly now: Date
}): SpreadsheetTable {
  const { messages } = params
  return {
    header: [
      messages.columnName,
      messages.columnCode,
      messages.columnState,
      messages.columnDiscount,
      messages.columnStartsAt,
      messages.columnEndsAt,
      messages.columnUses,
      messages.columnDiscountGiven,
      messages.columnLeads,
    ],
    rows: params.campaigns.map((campaign) => [
      campaign.name,
      campaign.fixedCode,
      messages[STATE_LABEL_KEY[campaignState(campaign, params.now)]],
      campaign.discount.kind === 'percent' ? `${campaign.discount.value}%` : campaign.discount.value / 100,
      campaign.startsAt,
      campaign.endsAt,
      campaign.stats.redemptionCount,
      campaign.stats.discountCents / 100,
      campaign.stats.leadCount,
    ]),
  }
}
