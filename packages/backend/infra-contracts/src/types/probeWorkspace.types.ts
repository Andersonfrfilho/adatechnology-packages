/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PROBE_WORKSPACE_OUTCOME } from '../probeWorkspace.constant'

export type ProbeWorkspaceParams = {
  readonly token: string
  readonly workspaceId: string
  readonly fetchImplementation?: typeof fetch
  readonly now?: () => number
}

type ProbeOutcome = (typeof PROBE_WORKSPACE_OUTCOME)[keyof typeof PROBE_WORKSPACE_OUTCOME]

export type ProbeWorkspaceResult =
  | { readonly outcome: Exclude<ProbeOutcome, typeof PROBE_WORKSPACE_OUTCOME.RATE_LIMITED> }
  | { readonly outcome: typeof PROBE_WORKSPACE_OUTCOME.RATE_LIMITED; readonly retryAfterSeconds?: number }
