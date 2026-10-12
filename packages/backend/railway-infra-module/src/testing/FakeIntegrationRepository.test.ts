/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { INFRA_INTEGRATION_PROVIDER } from '@adatechnology/railway-infra-contracts'
import { FakeIntegrationRepository } from './FakeIntegrationRepository'

const PARAMS = {
  provider: INFRA_INTEGRATION_PROVIDER.RAILWAY,
  workspaceId: 'workspace-1',
  ciphertext: 'v1.sealed',
  keyId: 'abcd1234abcd1234',
  tokenHint: '6789',
} as const

describe('FakeIntegrationRepository', () => {
  it('marca criacao e depois troca, preservando createdAt', async () => {
    const repository = new FakeIntegrationRepository()
    const first = await repository.upsertLocked(PARAMS)
    const second = await repository.upsertLocked({ ...PARAMS, tokenHint: '0000' })

    expect(first.wasReplacement).toBe(false)
    expect(second.wasReplacement).toBe(true)
    expect(second.record.tokenHint).toBe('0000')
    expect(second.record.createdAt).toEqual(first.record.createdAt)
  })

  it('deleteLocked devolve true uma vez e false depois', async () => {
    const repository = new FakeIntegrationRepository()
    await repository.upsertLocked(PARAMS)

    expect(await repository.deleteLocked(INFRA_INTEGRATION_PROVIDER.RAILWAY)).toBe(true)
    expect(await repository.deleteLocked(INFRA_INTEGRATION_PROVIDER.RAILWAY)).toBe(false)
    expect(await repository.findByProvider(INFRA_INTEGRATION_PROVIDER.RAILWAY)).toBeUndefined()
  })
})
