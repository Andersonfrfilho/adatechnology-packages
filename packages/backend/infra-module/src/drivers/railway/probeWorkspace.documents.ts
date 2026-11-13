/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { z } from 'zod'

export const PROBE_WORKSPACE_QUERY = `query ProbeWorkspace($workspaceId: String!) {
  workspace(workspaceId: $workspaceId) { id name }
}`

export const PROBE_ACCOUNT_SCOPE_QUERY = 'query ProbeAccountScope { me { id } }'

export const probeWorkspaceResponseSchema = z.object({
  workspace: z.object({ id: z.string(), name: z.string().nullish() }).nullish(),
})

export const probeAccountScopeResponseSchema = z.object({
  me: z.object({ id: z.string() }).nullish(),
})
