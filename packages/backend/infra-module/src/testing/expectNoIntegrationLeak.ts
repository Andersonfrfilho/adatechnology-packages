/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { expect } from 'bun:test'

import { INTEGRATION_PASSWORD, type IntegrationHarness } from './buildIntegrationHarness'
import { DECOY_TOKEN } from './buildProviderHarness'

function serializeObserved(value: unknown): string {
  if (value instanceof Error) {
    const context = (value as { readonly context?: unknown }).context ?? {}
    return `${value.name} ${value.message} ${JSON.stringify(context)} ${JSON.stringify(value)}`
  }
  return JSON.stringify(value) ?? ''
}

type ExpectNoLeakParams = { readonly harness: IntegrationHarness; readonly observed: readonly unknown[] }

/** Varredura da isca: resultado, erro, auditoria, logs e cache nunca carregam o token, a senha nem o cifrado. */
export function expectNoIntegrationLeak({ harness, observed }: ExpectNoLeakParams): void {
  const { repository, auditCalls, logs, cache } = harness
  const haystack = [
    ...observed.map(serializeObserved),
    JSON.stringify(auditCalls),
    logs.join('\n'),
    JSON.stringify([...cache.store]),
    JSON.stringify(cache.setCalls),
    JSON.stringify(cache.deletedKeys),
  ].join('\n')

  expect(haystack).not.toContain(DECOY_TOKEN)
  expect(haystack).not.toContain(INTEGRATION_PASSWORD)
  for (const ciphertext of repository.writtenCiphertexts) expect(haystack).not.toContain(ciphertext)
}
