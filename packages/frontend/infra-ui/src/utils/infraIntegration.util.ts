/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_ACCESS_STATUS, type InfraAccessStatus } from '../constants/infra.constant'
import { DEFAULT_INFRA_MESSAGES, type InfraMessages } from '../locales'
import {
  INFRA_INTEGRATION_ERROR_CODE,
  INFRA_INTEGRATION_STATE,
  INFRA_INTEGRATION_TONE,
  INTEGRATION_TOKEN_ISSUE,
  INTEGRATION_TOKEN_MAX_LENGTH,
  INTEGRATION_TOKEN_MIN_LENGTH,
  INTEGRATION_TOKEN_PATTERN,
  type InfraIntegrationState,
  type InfraIntegrationTone,
  type IntegrationTokenIssue,
} from '../constants/infraIntegration.constant'
import { getZonedParts } from './zonedTime.util'
import { getErrorCode } from './errorCode.util'

export type TokenValidation =
  { readonly isValid: true } | { readonly isValid: false; readonly issue: IntegrationTokenIssue }

export type IntegrationStateDescription = {
  readonly tone: InfraIntegrationTone
  readonly title: string
  readonly action: string
}

/** Cola do gerenciador de senhas costuma trazer quebra de linha ou espaco nas pontas; no meio e erro de verdade. */
export function normalizeToken(rawToken: string): string {
  return rawToken.trim()
}

/** Nunca devolve o valor: a mensagem da tela nao pode ecoar o que foi digitado. */
export function validateTokenFormat(rawToken: string): TokenValidation {
  const token = normalizeToken(rawToken)

  if (token.length === 0) return { isValid: false, issue: INTEGRATION_TOKEN_ISSUE.EMPTY }
  if (token.length < INTEGRATION_TOKEN_MIN_LENGTH) return { isValid: false, issue: INTEGRATION_TOKEN_ISSUE.TOO_SHORT }
  if (token.length > INTEGRATION_TOKEN_MAX_LENGTH) return { isValid: false, issue: INTEGRATION_TOKEN_ISSUE.TOO_LONG }
  if (!INTEGRATION_TOKEN_PATTERN.test(token))
    return { isValid: false, issue: INTEGRATION_TOKEN_ISSUE.INVALID_CHARACTERS }

  return { isValid: true }
}

export function canSubmitIntegration({
  token,
  password,
  isPending,
}: {
  readonly token: string
  readonly password: string
  readonly isPending: boolean
}): boolean {
  return !isPending && validateTokenFormat(token).isValid && password.length > 0
}

/** A tela decide pelo codigo da API; a mensagem do servidor nunca chega ao usuario. */
export function resolveIntegrationErrorMessage(
  error: unknown,
  messages: InfraMessages = DEFAULT_INFRA_MESSAGES,
): string {
  const integrationErrors: Readonly<Record<string, string>> = messages.integration.errors
  const genericErrors: Readonly<Record<string, string>> = messages.errors
  const code = getErrorCode(error)
  if (code === undefined) return messages.errors.UNKNOWN

  return integrationErrors[code] ?? genericErrors[code] ?? messages.errors.UNKNOWN
}

/** Fora de producao a funcao simplesmente nao existe: e informacao, nao falha. */
export function isInformationalIntegrationError(error: unknown): boolean {
  return getErrorCode(error) === INFRA_INTEGRATION_ERROR_CODE.PRODUCTION_ONLY
}

const STATE_TONE: Readonly<Record<InfraIntegrationState, InfraIntegrationTone>> = {
  [INFRA_INTEGRATION_STATE.NOT_CONFIGURED]: INFRA_INTEGRATION_TONE.NEUTRAL,
  [INFRA_INTEGRATION_STATE.CONFIGURED]: INFRA_INTEGRATION_TONE.OK,
  [INFRA_INTEGRATION_STATE.KEY_MISSING]: INFRA_INTEGRATION_TONE.ERROR,
  [INFRA_INTEGRATION_STATE.KEY_MISMATCH]: INFRA_INTEGRATION_TONE.WARNING,
  [INFRA_INTEGRATION_STATE.SECRET_UNREADABLE]: INFRA_INTEGRATION_TONE.WARNING,
  [INFRA_INTEGRATION_STATE.WORKSPACE_MISMATCH]: INFRA_INTEGRATION_TONE.WARNING,
  [INFRA_INTEGRATION_STATE.STORE_UNAVAILABLE]: INFRA_INTEGRATION_TONE.WARNING,
}

export function describeIntegrationState(
  state: InfraIntegrationState,
  messages: InfraMessages = DEFAULT_INFRA_MESSAGES,
): IntegrationStateDescription {
  const { title, action } = messages.integration.states[state]

  return { tone: STATE_TONE[state], title, action }
}

/** Sempre no fuso de Brasilia, como o resto da tela de infra; data invalida vira `undefined` em vez de "NaN". */
export function formatIntegrationUpdatedAt(isoTimestamp: string): string | undefined {
  const date = new Date(isoTimestamp)
  if (Number.isNaN(date.getTime())) return undefined

  const parts = getZonedParts(date)
  const pad = (value: number): string => String(value).padStart(2, '0')

  return `${pad(parts.day)}/${pad(parts.month)}/${parts.year} ${pad(parts.hour)}:${pad(parts.minute)}`
}

export type IntegrationAccessDescription = {
  readonly tone: InfraIntegrationTone
  readonly label: string
}

const ACCESS_TONE: Readonly<Record<InfraAccessStatus, InfraIntegrationTone>> = {
  [INFRA_ACCESS_STATUS.OK]: INFRA_INTEGRATION_TONE.OK,
  [INFRA_ACCESS_STATUS.TOKEN_INVALID]: INFRA_INTEGRATION_TONE.ERROR,
  [INFRA_ACCESS_STATUS.BILLING_UNAVAILABLE]: INFRA_INTEGRATION_TONE.WARNING,
  [INFRA_ACCESS_STATUS.UNAVAILABLE]: INFRA_INTEGRATION_TONE.WARNING,
}

/** Sem verificacao ainda: `undefined` vira um selo neutro, nunca um "ok" por omissao. */
export function describeIntegrationAccess(
  access: InfraAccessStatus | undefined,
  messages: InfraMessages = DEFAULT_INFRA_MESSAGES,
): IntegrationAccessDescription {
  if (access === undefined) {
    return { tone: INFRA_INTEGRATION_TONE.NEUTRAL, label: messages.integration.status.accessUnknown }
  }

  return { tone: ACCESS_TONE[access], label: messages.integration.access[access] }
}
