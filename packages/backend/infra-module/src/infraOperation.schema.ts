/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { z } from 'zod'

export const infraServiceResultsSchema = z.array(
  z.object({
    serviceName: z.string(),
    outcome: z.enum(['ok', 'failed', 'skipped']),
    errorCode: z.string().optional(),
  }),
)
