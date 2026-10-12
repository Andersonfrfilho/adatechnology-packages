/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import {
  INFRA_AUDIT_ACTOR_TYPE,
  INFRA_AUDIT_ACTION,
  INFRA_AUDIT_TARGET,
  type InfraAuditAction,
} from '@adatechnology/railway-infra-contracts'
import {
  RailwayRateLimitedError,
  RailwayRequestFailedError,
  InfraNotConfiguredError,
} from '@adatechnology/railway-infra-contracts'
import {
  InfraIntegrationEnvironmentManagedError,
  InfraIntegrationLockedError,
  InfraIntegrationPasswordInvalidError,
  InfraIntegrationProductionOnlyError,
  InfraIntegrationTokenRejectedError,
  InfraIntegrationTokenTooBroadError,
  InfraIntegrationWorkspaceNotFoundError,
  InfraSecretKeyMissingError,
} from '@adatechnology/railway-infra-contracts'
import {
  INTEGRATION_AGENT_ID,
  INTEGRATION_IP_ADDRESS,
  INTEGRATION_PASSWORD,
  buildIntegrationHarness,
  type IntegrationHarnessOptions,
} from './testing/buildIntegrationHarness'
import { DECOY_TOKEN } from './testing/buildProviderHarness'
import { expectNoIntegrationLeak } from './testing/expectNoIntegrationLeak'
import { INFRA_INTEGRATION_AUDIT_REASON as REASON } from '@adatechnology/railway-infra-contracts'
import { PROBE_WORKSPACE_OUTCOME as PROBE } from '@adatechnology/railway-infra-contracts'
import { SaveInfraIntegrationUseCase } from './saveInfraIntegration.use-case'
import type { VerifyAdminPasswordResult } from '@adatechnology/railway-infra-contracts'
import type { ProbeWorkspaceResult } from '@adatechnology/railway-infra-contracts'

type RefusalCase = {
  readonly name: string
  readonly options?: IntegrationHarnessOptions
  readonly password?: VerifyAdminPasswordResult
  readonly probe?: ProbeWorkspaceResult
  readonly error: new (...args: never[]) => Error
  readonly action?: InfraAuditAction
  readonly reason: string
  readonly passwordChecked: boolean
  readonly probeCalled: boolean
}

const DENIED = INFRA_AUDIT_ACTION.INFRA_INTEGRATION_DENIED
const base = { passwordChecked: false, probeCalled: false }
const afterPassword = { passwordChecked: true, probeCalled: false }
const afterProbe = { passwordChecked: true, probeCalled: true }

const CASES: readonly RefusalCase[] = [
  {
    ...base,
    name: 'fora de producao',
    options: { config: { env: 'staging' } },
    error: InfraIntegrationProductionOnlyError,
    reason: REASON.PRODUCTION_ONLY,
  },
  {
    ...base,
    name: 'sem chave de cifra',
    options: { config: { encryptionKeyBase64: '' } },
    error: InfraSecretKeyMissingError,
    reason: REASON.KEY_MISSING,
  },
  {
    ...base,
    name: 'sem workspace no ambiente',
    options: { config: { workspaceId: '' } },
    error: InfraNotConfiguredError,
    reason: REASON.NOT_CONFIGURED,
  },
  {
    ...base,
    name: 'sem environment id',
    options: { config: { environmentId: '' } },
    error: InfraNotConfiguredError,
    reason: REASON.NOT_CONFIGURED,
  },
  {
    ...base,
    name: 'token vindo da variavel de ambiente',
    options: { config: { environmentToken: 'qualquer-valor-1234' } },
    error: InfraIntegrationEnvironmentManagedError,
    reason: REASON.ENVIRONMENT_MANAGED,
  },
  {
    ...afterPassword,
    name: 'senha invalida',
    password: { outcome: 'invalid' },
    error: InfraIntegrationPasswordInvalidError,
    reason: REASON.PASSWORD_INVALID,
  },
  {
    ...afterPassword,
    name: 'agente bloqueado',
    password: { outcome: 'locked', retryAfterSeconds: 90, isNewLock: false },
    error: InfraIntegrationLockedError,
    reason: REASON.LOCKED,
  },
  {
    ...afterPassword,
    name: 'bloqueio novo',
    password: { outcome: 'locked', retryAfterSeconds: 900, isNewLock: true },
    error: InfraIntegrationLockedError,
    reason: REASON.LOCKED,
    action: INFRA_AUDIT_ACTION.INFRA_INTEGRATION_LOCKED,
  },
  {
    ...afterProbe,
    name: 'probe: token recusado',
    probe: { outcome: PROBE.TOKEN_REJECTED },
    error: InfraIntegrationTokenRejectedError,
    reason: REASON.TOKEN_REJECTED,
  },
  {
    ...afterProbe,
    name: 'probe: workspace inexistente',
    probe: { outcome: PROBE.WORKSPACE_NOT_FOUND },
    error: InfraIntegrationWorkspaceNotFoundError,
    reason: REASON.WORKSPACE_NOT_FOUND,
  },
  {
    ...afterProbe,
    name: 'probe: token amplo demais',
    probe: { outcome: PROBE.TOO_BROAD },
    error: InfraIntegrationTokenTooBroadError,
    reason: REASON.TOKEN_TOO_BROAD,
  },
  {
    ...afterProbe,
    name: 'probe: Railway fora',
    probe: { outcome: PROBE.UNAVAILABLE },
    error: RailwayRequestFailedError,
    reason: REASON.UNAVAILABLE,
  },
  {
    ...afterProbe,
    name: 'probe: limite do Railway',
    probe: { outcome: PROBE.RATE_LIMITED, retryAfterSeconds: 42 },
    error: RailwayRateLimitedError,
    reason: REASON.RATE_LIMITED,
  },
]

async function runRefusal(testCase: RefusalCase) {
  const harness = buildIntegrationHarness(testCase.options)
  if (testCase.password) harness.state.passwordResult = testCase.password
  if (testCase.probe) harness.state.probeResult = testCase.probe
  const useCase = new SaveInfraIntegrationUseCase(harness.dependencies)
  const error = await useCase
    .execute({
      actor: { agentId: INTEGRATION_AGENT_ID },
      ipAddress: INTEGRATION_IP_ADDRESS,
      token: DECOY_TOKEN,
      password: INTEGRATION_PASSWORD,
    })
    .then(
      () => undefined,
      (caught: unknown) => caught,
    )
  return { harness, error }
}

describe('SaveInfraIntegrationUseCase: recusas', () => {
  for (const testCase of CASES) {
    it(`${testCase.name}: erro certo, zero gravacao, auditoria fechada`, async () => {
      const { harness, error } = await runRefusal(testCase)

      expect(error).toBeInstanceOf(testCase.error)
      expect(harness.repository.upsertCalls).toBe(0)
      expect(harness.repository.records.size).toBe(0)
      expect(harness.provider.invalidations).toBe(0)
      expect(harness.cache.deletedKeys).toEqual([])
      expect(harness.passwordCalls.length).toBe(testCase.passwordChecked ? 1 : 0)
      expect(harness.probeCalls.length).toBe(testCase.probeCalled ? 1 : 0)
      expect(harness.auditCalls).toEqual([
        {
          actorType: INFRA_AUDIT_ACTOR_TYPE.AGENT,
          actorId: INTEGRATION_AGENT_ID,
          ipAddress: INTEGRATION_IP_ADDRESS,
          action: testCase.action ?? DENIED,
          targetType: INFRA_AUDIT_TARGET.INFRA_INTEGRATION,
          metadata: { reason: testCase.reason },
        },
      ])
      expectNoIntegrationLeak({ harness, observed: [error] })
    })
  }

  it('propaga o Retry-After do bloqueio e do limite do Railway', async () => {
    const locked = await runRefusal(CASES[6] as RefusalCase)
    const limited = await runRefusal(CASES[12] as RefusalCase)

    expect((locked.error as InfraIntegrationLockedError).context).toEqual({ retryAfterSeconds: 90 })
    expect((limited.error as RailwayRateLimitedError).context).toEqual({ retryAfterSeconds: 42 })
  })

  it('consulta o probe com o workspace do ambiente, nunca outro', async () => {
    const harness = buildIntegrationHarness()
    await new SaveInfraIntegrationUseCase(harness.dependencies).execute({
      actor: { agentId: INTEGRATION_AGENT_ID },
      token: DECOY_TOKEN,
      password: INTEGRATION_PASSWORD,
    })

    expect(harness.probeCalls).toEqual([{ token: DECOY_TOKEN, workspaceId: harness.dependencies.config.workspaceId }])
  })
})
