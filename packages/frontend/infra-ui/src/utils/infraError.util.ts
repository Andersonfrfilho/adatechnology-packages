/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { DEFAULT_INFRA_MESSAGES, type InfraMessages } from '../locales'
import { getErrorCode } from './errorCode.util'

/** A tela decide pelo código da API, nunca pela mensagem do servidor. */
export function resolveInfraErrorMessage(error: unknown, messages: InfraMessages = DEFAULT_INFRA_MESSAGES): string {
  const errorMessages: Readonly<Record<string, string>> = messages.errors
  const code = getErrorCode(error)

  return (code !== undefined ? errorMessages[code] : undefined) ?? messages.errors.UNKNOWN
}
