/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { InfraError } from './infraBase.error'
import { INFRA_ERROR_CODES } from './infraErrorCode.constant'
import {
  InfraIntegrationConcurrentChangeError,
  InfraIntegrationEnvironmentManagedError,
  InfraIntegrationLockedError,
  InfraIntegrationPasswordInvalidError,
  InfraIntegrationProductionOnlyError,
  InfraIntegrationTokenRejectedError,
  InfraIntegrationTokenTooBroadError,
  InfraIntegrationWorkspaceNotFoundError,
  InfraSecretKeyMissingError,
} from './infraIntegration.error'

type IntegrationErrorCase = {
  readonly name: string
  readonly build: () => InfraError
  readonly code: string
  readonly statusCode: number
}

const SECRET_SENTINEL = 'ISCA-SEGREDO-0000'

const INTEGRATION_ERROR_CASES: IntegrationErrorCase[] = [
  {
    name: 'InfraIntegrationConcurrentChangeError',
    build: () => new InfraIntegrationConcurrentChangeError(),
    code: INFRA_ERROR_CODES.INFRA_INTEGRATION_CONCURRENT_CHANGE,
    statusCode: 409,
  },
  {
    name: 'InfraSecretKeyMissingError',
    build: () => new InfraSecretKeyMissingError(),
    code: INFRA_ERROR_CODES.INFRA_SECRET_KEY_MISSING,
    statusCode: 503,
  },
  {
    name: 'InfraIntegrationProductionOnlyError',
    build: () => new InfraIntegrationProductionOnlyError(),
    code: INFRA_ERROR_CODES.INFRA_INTEGRATION_PRODUCTION_ONLY,
    statusCode: 403,
  },
  {
    name: 'InfraIntegrationPasswordInvalidError',
    build: () => new InfraIntegrationPasswordInvalidError(),
    code: INFRA_ERROR_CODES.INFRA_INTEGRATION_PASSWORD_INVALID,
    statusCode: 403,
  },
  {
    name: 'InfraIntegrationLockedError',
    build: () => new InfraIntegrationLockedError(900),
    code: INFRA_ERROR_CODES.INFRA_INTEGRATION_LOCKED,
    statusCode: 423,
  },
  {
    name: 'InfraIntegrationTokenRejectedError',
    build: () => new InfraIntegrationTokenRejectedError(),
    code: INFRA_ERROR_CODES.INFRA_INTEGRATION_TOKEN_REJECTED,
    statusCode: 422,
  },
  {
    name: 'InfraIntegrationTokenTooBroadError',
    build: () => new InfraIntegrationTokenTooBroadError(),
    code: INFRA_ERROR_CODES.INFRA_INTEGRATION_TOKEN_TOO_BROAD,
    statusCode: 422,
  },
  {
    name: 'InfraIntegrationWorkspaceNotFoundError',
    build: () => new InfraIntegrationWorkspaceNotFoundError(),
    code: INFRA_ERROR_CODES.INFRA_INTEGRATION_WORKSPACE_NOT_FOUND,
    statusCode: 422,
  },
  {
    name: 'InfraIntegrationEnvironmentManagedError',
    build: () => new InfraIntegrationEnvironmentManagedError(),
    code: INFRA_ERROR_CODES.INFRA_INTEGRATION_ENVIRONMENT_MANAGED,
    statusCode: 409,
  },
]

describe('infra integration errors', () => {
  it.each(INTEGRATION_ERROR_CASES)('$name carries its code and status', ({ name, build, code, statusCode }) => {
    const error = build()

    expect(error).toBeInstanceOf(InfraError)
    expect(error.name).toBe(name)
    expect(error.code).toBe(code)
    expect(error.statusCode).toBe(statusCode)
  })

  it.each(INTEGRATION_ERROR_CASES)('$name message carries no credential, password or sentinel', ({ build }) => {
    const message = build().message

    expect(message).not.toMatch(/token/i)
    expect(message).not.toContain(SECRET_SENTINEL)
    expect(message).not.toMatch(/ISCA/)
  })

  it('locked error exposes retryAfterSeconds in context for the Retry-After header', () => {
    const error = new InfraIntegrationLockedError(900)

    expect(error.context).toEqual({ retryAfterSeconds: 900 })
  })
})
