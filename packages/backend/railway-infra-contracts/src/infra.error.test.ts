/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { RailwayInfraError } from './railwayInfra.error'
import { RAILWAY_INFRA_ERROR_CODES } from './railwayInfraErrorCode.constant'
import {
  InfraEnvironmentNotFoundError,
  InfraEnvironmentProtectedError,
  InfraInvalidScheduleError,
  InfraKeepOnUntilRequiredError,
  InfraNotConfiguredError,
  InfraOperationInProgressError,
  InfraOperationNotFoundError,
  RailwayRateLimitedError,
  RailwayRequestFailedError,
} from './infra.error'

type InfraErrorCase = {
  readonly name: string
  readonly build: () => RailwayInfraError
  readonly code: string
  readonly statusCode: number
}

const INFRA_ERROR_CASES: InfraErrorCase[] = [
  {
    name: 'InfraNotConfiguredError',
    build: () => new InfraNotConfiguredError(),
    code: RAILWAY_INFRA_ERROR_CODES.INFRA_NOT_CONFIGURED,
    statusCode: 503,
  },
  {
    name: 'InfraEnvironmentProtectedError',
    build: () => new InfraEnvironmentProtectedError(),
    code: RAILWAY_INFRA_ERROR_CODES.INFRA_ENVIRONMENT_PROTECTED,
    statusCode: 403,
  },
  {
    name: 'InfraEnvironmentNotFoundError',
    build: () => new InfraEnvironmentNotFoundError(),
    code: RAILWAY_INFRA_ERROR_CODES.INFRA_ENVIRONMENT_NOT_FOUND,
    statusCode: 404,
  },
  {
    name: 'InfraOperationInProgressError',
    build: () => new InfraOperationInProgressError(),
    code: RAILWAY_INFRA_ERROR_CODES.INFRA_OPERATION_IN_PROGRESS,
    statusCode: 409,
  },
  {
    name: 'InfraOperationNotFoundError',
    build: () => new InfraOperationNotFoundError(),
    code: RAILWAY_INFRA_ERROR_CODES.INFRA_OPERATION_NOT_FOUND,
    statusCode: 404,
  },
  {
    name: 'RailwayRequestFailedError',
    build: () => new RailwayRequestFailedError('fetchProjects'),
    code: RAILWAY_INFRA_ERROR_CODES.RAILWAY_REQUEST_FAILED,
    statusCode: 502,
  },
  {
    name: 'RailwayRateLimitedError',
    build: () => new RailwayRateLimitedError(),
    code: RAILWAY_INFRA_ERROR_CODES.RAILWAY_RATE_LIMITED,
    statusCode: 503,
  },
  {
    name: 'InfraKeepOnUntilRequiredError',
    build: () => new InfraKeepOnUntilRequiredError(),
    code: RAILWAY_INFRA_ERROR_CODES.INFRA_KEEP_ON_UNTIL_REQUIRED,
    statusCode: 400,
  },
  {
    name: 'InfraInvalidScheduleError',
    build: () => new InfraInvalidScheduleError(),
    code: RAILWAY_INFRA_ERROR_CODES.INFRA_INVALID_SCHEDULE,
    statusCode: 400,
  },
]

describe('infra errors', () => {
  it.each(INFRA_ERROR_CASES)('$name carries its code and status', ({ name, build, code, statusCode }) => {
    const error = build()

    expect(error).toBeInstanceOf(RailwayInfraError)
    expect(error.name).toBe(name)
    expect(error.code).toBe(code)
    expect(error.statusCode).toBe(statusCode)
  })

  it.each(INFRA_ERROR_CASES)('$name message never mentions a token', ({ build }) => {
    expect(build().message).not.toMatch(/token/i)
  })
})
