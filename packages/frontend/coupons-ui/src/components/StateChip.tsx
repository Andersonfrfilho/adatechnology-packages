/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { CampaignState } from '@adatechnology/coupon-contracts'

import { STATE_LABEL_KEY } from '../lib/labels'
import { useCouponsText } from '../providers/CouponsProvider'

export function StateChip({ state }: { readonly state: CampaignState }) {
  const { messages } = useCouponsText()
  return <span className={`acp-chip acp-chip--${state}`}>{messages[STATE_LABEL_KEY[state]]}</span>
}
