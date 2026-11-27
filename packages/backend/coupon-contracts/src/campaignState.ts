/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Campaign } from './coupon.types'
import { CAMPAIGN_STATE, type CampaignState } from './schemas'

/**
 * Situação que o painel mostra. Encerrada vence tudo (passou do fim, ligada ou não); depois,
 * desligada; ligada com início futuro é agendada; o resto está no ar. A lista filtra pela mesma regra.
 */
export function campaignState(campaign: Pick<Campaign, 'isActive' | 'startsAt' | 'endsAt'>, at: Date): CampaignState {
  if (campaign.endsAt !== null && Date.parse(campaign.endsAt) <= at.getTime()) return CAMPAIGN_STATE.ENDED
  if (!campaign.isActive) return CAMPAIGN_STATE.INACTIVE
  if (campaign.startsAt !== null && Date.parse(campaign.startsAt) > at.getTime()) return CAMPAIGN_STATE.SCHEDULED
  return CAMPAIGN_STATE.RUNNING
}
