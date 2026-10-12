/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { buildProviderHarness, buildRecord, DECOY_TOKEN, OTHER_KEY_BASE64 } from './testing/buildProviderHarness'
import { loadInfraSecretKey } from './infraSecretKey'
import { sealSecret } from './infraSecretCipher'

function seedPanel(harness: ReturnType<typeof buildProviderHarness>, overrides = {}): void {
  harness.repository.seed(buildRecord(overrides))
}

describe('DefaultInfraGatewayProvider precedence', () => {
  it('environment token wins, is built once and never reads the table to resolve', async () => {
    const harness = buildProviderHarness({ config: { environmentToken: 'ISCA-ENV-TOKEN' } })
    seedPanel(harness)
    const first = await harness.provider.resolve()
    const second = await harness.provider.resolve()
    expect(first).toBeDefined()
    expect(second).toBe(first)
    expect(harness.builtWith).toEqual([{ token: 'ISCA-ENV-TOKEN', workspaceId: 'workspace-1' }])
    expect(harness.repository.reads).toBe(0)
  })

  it('describe reports the coexisting panel row only in production', async () => {
    const harness = buildProviderHarness({ config: { environmentToken: 'ISCA-ENV-TOKEN' } })
    seedPanel(harness)
    const description = await harness.provider.describe()
    expect(description).toMatchObject({ source: 'environment', state: 'configured', environmentTokenAlsoPresent: true })
    const development = buildProviderHarness({ config: { environmentToken: 'ISCA-ENV-TOKEN', env: 'development' } })
    seedPanel(development)
    expect((await development.provider.describe()).environmentTokenAlsoPresent).toBe(false)
    expect(development.repository.reads).toBe(0)
  })

  it('uses the panel credential in production with the decrypted token', async () => {
    const harness = buildProviderHarness()
    seedPanel(harness, { updatedByAgentId: 'agent-1' })
    expect(await harness.provider.resolve()).toBeDefined()
    expect(harness.builtWith).toEqual([{ token: DECOY_TOKEN, workspaceId: 'workspace-1' }])
    expect(await harness.provider.describe()).toMatchObject({
      source: 'panel',
      state: 'configured',
      workspaceId: 'workspace-1',
      tokenHint: '6789',
      updatedByAgentId: 'agent-1',
      environmentTokenAlsoPresent: false,
    })
  })

  it('does not read the table outside production', async () => {
    const harness = buildProviderHarness({ config: { env: 'development' } })
    harness.repository.failWith = new Error('table must not be read')
    seedPanel(harness)
    expect(await harness.provider.resolve()).toBeUndefined()
    expect(await harness.provider.describe()).toMatchObject({ source: 'none', state: 'not_configured' })
    expect(harness.repository.reads).toBe(0)
  })

  it('reports not_configured without a row or without workspace/environment ids', async () => {
    const empty = buildProviderHarness()
    expect(await empty.provider.resolve()).toBeUndefined()
    expect(await empty.provider.describe()).toMatchObject({ source: 'none', state: 'not_configured' })
    const noIds = buildProviderHarness({ config: { environmentId: '' } })
    seedPanel(noIds)
    expect(await noIds.provider.resolve()).toBeUndefined()
    expect(noIds.repository.reads).toBe(0)
  })
})

describe('DefaultInfraGatewayProvider fail closed', () => {
  const otherKey = loadInfraSecretKey(OTHER_KEY_BASE64)
  const tamperedCiphertext = (() => {
    const parts = buildRecord().ciphertext.split('.')
    parts[4] = Buffer.from('tampered-bytes').toString('base64url')
    return parts.join('.')
  })()
  const cases = [
    { state: 'key_missing', config: { encryptionKeyBase64: '' }, record: {} },
    { state: 'key_mismatch', config: {}, record: { keyId: otherKey.keyId } },
    { state: 'workspace_mismatch', config: {}, record: { workspaceId: 'workspace-2' } },
    { state: 'secret_unreadable', config: {}, record: { ciphertext: tamperedCiphertext } },
    {
      state: 'secret_unreadable',
      config: {},
      record: {
        ciphertext: sealSecret({ plaintext: DECOY_TOKEN, key: otherKey, provider: 'railway', workspaceId: 'x' }),
      },
    },
  ]

  for (const { state, config, record } of cases) {
    it(`${state}: no gateway, no fallback, no secret in logs or description`, async () => {
      const harness = buildProviderHarness({ config })
      const row = buildRecord(record)
      harness.repository.seed(row)
      expect(await harness.provider.resolve()).toBeUndefined()
      const description = await harness.provider.describe()
      expect(description).toMatchObject({ source: 'none', state })
      expect(harness.builtWith).toHaveLength(0)
      const exposed = JSON.stringify([harness.logs, description])
      expect(exposed).not.toContain(DECOY_TOKEN)
      expect(exposed).not.toContain(row.ciphertext)
    })
  }

  it('store_unavailable: no gateway, logs without the error message, and retries on the next call', async () => {
    const harness = buildProviderHarness()
    seedPanel(harness)
    harness.repository.failWith = new Error(`insert ... ${DECOY_TOKEN}`)
    expect(await harness.provider.resolve()).toBeUndefined()
    expect(await harness.provider.describe()).toMatchObject({ source: 'none', state: 'store_unavailable' })
    expect(harness.logs.join('\n')).not.toContain(DECOY_TOKEN)
    harness.repository.failWith = undefined
    expect(await harness.provider.resolve()).toBeDefined()
  })

  it('a failure after a good read never serves the previous gateway beyond the interval', async () => {
    const harness = buildProviderHarness()
    seedPanel(harness)
    expect(await harness.provider.resolve()).toBeDefined()
    harness.clock.now += 30_000
    harness.repository.failWith = new Error('down')
    expect(await harness.provider.resolve()).toBeUndefined()
  })
})
