/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { UnauthenticatedError } from '@adatechnology/scheduling-contracts'
import type { RequestContext } from '@adatechnology/module-http'

export function requireCompany(context: RequestContext): string {
  if (!context.auth?.companyId) {
    throw new UnauthenticatedError()
  }
  return context.auth.companyId
}
