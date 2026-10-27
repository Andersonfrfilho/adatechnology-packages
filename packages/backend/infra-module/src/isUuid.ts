/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { z } from 'zod'

const uuidSchema = z.string().uuid()

/** A coluna `audit_logs.target_id` é uuid: id fora do formato vai na metadata, nunca no alvo. */
export function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success
}
