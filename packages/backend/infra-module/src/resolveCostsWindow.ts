/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_COSTS_WINDOW_SOURCE } from '@adatechnology/infra-contracts'
import type { ResolveCostsWindowResult } from '@adatechnology/infra-contracts'
import type { InfraGatewayInterface } from '@adatechnology/infra-contracts'

type ResolveCostsWindowParams = {
  readonly gateway: InfraGatewayInterface
  readonly now: () => Date
}

function buildCalendarMonthWindow(now: Date): ResolveCostsWindowResult {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 1)
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    windowSource: INFRA_COSTS_WINDOW_SOURCE.CALENDAR_MONTH,
  }
}

// Sem permissao de cobranca a tela continua: mes-calendario e sem total oficial.
export async function resolveCostsWindow(params: ResolveCostsWindowParams): Promise<ResolveCostsWindowResult> {
  try {
    const cycle = await params.gateway.getBillingCycle()
    return {
      start: cycle.start,
      end: cycle.end,
      windowSource: INFRA_COSTS_WINDOW_SOURCE.BILLING_CYCLE,
      officialTotal: cycle.currentUsage,
    }
  } catch {
    return buildCalendarMonthWindow(params.now())
  }
}
