/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { InfraError } from './infraBase.error'
import { INFRA_ERROR_CODES } from './infraErrorCode.constant'
import {
  InfraEnvironmentNotFoundError,
  InfraEnvironmentProtectedError,
  InfraInvalidScheduleError,
  InfraKeepOnUntilRequiredError,
  InfraNotConfiguredError,
  InfraOperationInProgressError,
  InfraOperationNotFoundError,
  InfraProviderRateLimitedError,
  InfraProviderRequestFailedError,
} from './infra.error'

type InfraErrorCase = {
  readonly name: string
  readonly build: () => InfraError
  readonly code: string
  readonly statusCode: number
}

const INFRA_ERROR_CASES: InfraErrorCase[] = [
  {
    name: 'InfraNotConfiguredError',
    build: () => new InfraNotConfiguredError(),
    code: INFRA_ERROR_CODES.INFRA_NOT_CONFIGURED,
    statusCode: 503,
  },
  {
    name: 'InfraEnvironmentProtectedError',
    build: () => new InfraEnvironmentProtectedError(),
    code: INFRA_ERROR_CODES.INFRA_ENVIRONMENT_PROTECTED,
    statusCode: 403,
  },
  {
    name: 'InfraEnvironmentNotFoundError',
    build: () => new InfraEnvironmentNotFoundError(),
    code: INFRA_ERROR_CODES.INFRA_ENVIRONMENT_NOT_FOUND,
    statusCode: 404,
  },
  {
    name: 'InfraOperationInProgressError',
    build: () => new InfraOperationInProgressError(),
    code: INFRA_ERROR_CODES.INFRA_OPERATION_IN_PROGRESS,
    statusCode: 409,
  },
  {
    name: 'InfraOperationNotFoundError',
    build: () => new InfraOperationNotFoundError(),
    code: INFRA_ERROR_CODES.INFRA_OPERATION_NOT_FOUND,
    statusCode: 404,
  },
  {
    name: 'InfraProviderRequestFailedError',
    build: () => new InfraProviderRequestFailedError('fetchProjects'),
    code: INFRA_ERROR_CODES.INFRA_PROVIDER_REQUEST_FAILED,
    statusCode: 502,
  },
  {
    name: 'InfraProviderRateLimitedError',
    build: () => new InfraProviderRateLimitedError(),
    code: INFRA_ERROR_CODES.INFRA_PROVIDER_RATE_LIMITED,
    statusCode: 503,
  },
  {
    name: 'InfraKeepOnUntilRequiredError',
    build: () => new InfraKeepOnUntilRequiredError(),
    code: INFRA_ERROR_CODES.INFRA_KEEP_ON_UNTIL_REQUIRED,
    statusCode: 400,
  },
  {
    name: 'InfraInvalidScheduleError',
    build: () => new InfraInvalidScheduleError(),
    code: INFRA_ERROR_CODES.INFRA_INVALID_SCHEDULE,
    statusCode: 400,
  },
]

describe('infra errors', () => {
  it.each(INFRA_ERROR_CASES)('$name carries its code and status', ({ name, build, code, statusCode }) => {
    const error = build()

    expect(error).toBeInstanceOf(InfraError)
    expect(error.name).toBe(name)
    expect(error.code).toBe(code)
    expect(error.statusCode).toBe(statusCode)
  })

  it.each(INFRA_ERROR_CASES)('$name message never mentions a token', ({ build }) => {
    expect(build().message).not.toMatch(/token/i)
  })
})
