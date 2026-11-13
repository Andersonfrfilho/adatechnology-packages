/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { resolveScheduleAction } from './resolveScheduleAction'
import type { InfraNextScheduledActionView, ResolveNextScheduledActionViewParams } from '@adatechnology/infra-contracts'

export function resolveNextScheduledActionView(
  params: ResolveNextScheduledActionViewParams,
): InfraNextScheduledActionView | undefined {
  const { nextScheduledAction } = resolveScheduleAction(params)
  if (!nextScheduledAction) return undefined
  return { kind: nextScheduledAction.kind, at: nextScheduledAction.at.toISOString() }
}
