/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type RecordFailureParams = {
  readonly agentId: string
  readonly windowSeconds: number
}

export type LockAgentParams = {
  readonly agentId: string
  readonly seconds: number
}
