/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraAuditEntry } from '@adatechnology/railway-infra-contracts'
import { buildFakeGateway, type FakeGateway, type FakeGatewayOptions } from './buildFakeGateway'
import { FAKE_NOW } from './fakeNow.constant'
import { FakeInfraCache } from './FakeInfraCache'
import { FakeOperationRepository } from './FakeOperationRepository'
import { FakeScheduleRepository } from './FakeScheduleRepository'
import type { PowerEnvironmentDependencies } from '../powerEnvironment.use-case'
import type { InfraSleep } from '@adatechnology/railway-infra-contracts'

export type PowerHarness = {
  readonly dependencies: PowerEnvironmentDependencies
  readonly gateway: FakeGateway
  readonly cache: FakeInfraCache
  readonly repository: FakeOperationRepository
  readonly scheduleRepository: FakeScheduleRepository
  readonly auditCalls: InfraAuditEntry[]
  readonly logMessages: string[]
  readonly sleeps: number[]
  failAudit: boolean
}

type HarnessOptions = {
  readonly gatewayOptions: FakeGatewayOptions
  readonly databaseWaitSeconds?: number
  readonly isConfigured?: boolean
  readonly now?: Date
}

function buildFakeSleep(sleeps: number[]): InfraSleep {
  return async (milliseconds: number) => {
    sleeps.push(milliseconds)
  }
}

function buildFakeLogger(logMessages: string[]): PowerEnvironmentDependencies['logger'] {
  return {
    info: (message) => void logMessages.push(message),
    error: (message) => void logMessages.push(message),
  }
}

export function buildPowerHarness(params: HarnessOptions): PowerHarness {
  const gateway = buildFakeGateway(params.gatewayOptions)
  const cache = new FakeInfraCache()
  const repository = new FakeOperationRepository()
  const scheduleRepository = new FakeScheduleRepository()
  const auditCalls: InfraAuditEntry[] = []
  const logMessages: string[] = []
  const sleeps: number[] = []

  const harness: PowerHarness = {
    gateway,
    cache,
    repository,
    scheduleRepository,
    auditCalls,
    logMessages,
    sleeps,
    failAudit: false,
    dependencies: {
      resolveGateway: async () => (params.isConfigured === false ? undefined : gateway),
      cache,
      operationRepository: repository,
      scheduleRepository,
      recordAudit: {
        execute: async (auditParams) => {
          if (harness.failAudit) throw new Error('audit down')
          auditCalls.push(auditParams)
        },
      },
      logger: buildFakeLogger(logMessages),
      sleep: buildFakeSleep(sleeps),
      managedPattern: 'staging',
      selfEnvironmentId: 'env-self',
      databaseWaitSeconds: params.databaseWaitSeconds ?? 120,
      now: () => params.now ?? FAKE_NOW,
    },
  }

  return harness
}
