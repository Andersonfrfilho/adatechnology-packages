/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraFailureCounterInterface } from '@adatechnology/infra-contracts'
import type { LockAgentParams, RecordFailureParams } from '@adatechnology/infra-contracts'

export class FakeFailureCounter implements InfraFailureCounterInterface {
  readonly failures = new Map<string, number>()
  readonly locks = new Map<string, number>()
  readonly windowSecondsUsed: number[] = []

  async recordFailure({ agentId, windowSeconds }: RecordFailureParams): Promise<number> {
    this.windowSecondsUsed.push(windowSeconds)
    const count = (this.failures.get(agentId) ?? 0) + 1
    this.failures.set(agentId, count)

    return count
  }

  async lock({ agentId, seconds }: LockAgentParams): Promise<void> {
    this.locks.set(agentId, seconds)
  }

  async getLockRemainingSeconds(agentId: string): Promise<number | undefined> {
    return this.locks.get(agentId)
  }

  async reset(agentId: string): Promise<void> {
    this.failures.delete(agentId)
  }
}
