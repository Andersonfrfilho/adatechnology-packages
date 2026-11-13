/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { InfraIntegrationConcurrentChangeError } from '@adatechnology/infra-contracts'
import { upsertIntegrationRow } from './upsertIntegrationRow'
import type { InfraIntegrationRecord } from '@adatechnology/infra-contracts'
import type { IntegrationRowOperations } from '@adatechnology/infra-contracts'

const RECORD = { id: 'integration-1', provider: 'railway' } as InfraIntegrationRecord

type Script = {
  readonly locks: readonly boolean[]
  readonly inserts: readonly boolean[]
  readonly replaces: readonly boolean[]
}

function buildOperations(script: Script): { readonly operations: IntegrationRowOperations; readonly calls: string[] } {
  const calls: string[] = []
  const queues = { locks: [...script.locks], inserts: [...script.inserts], replaces: [...script.replaces] }
  const operations: IntegrationRowOperations = {
    async lockExisting() {
      calls.push('lock')
      return queues.locks.shift() ?? false
    },
    async insertIfAbsent() {
      calls.push('insert')
      return queues.inserts.shift() ? RECORD : undefined
    },
    async replace() {
      calls.push('replace')
      return queues.replaces.shift() ? RECORD : undefined
    },
  }
  return { operations, calls }
}

describe('upsertIntegrationRow', () => {
  it('creates the row when none exists', async () => {
    const { operations } = buildOperations({ locks: [false], inserts: [true], replaces: [] })
    expect(await upsertIntegrationRow(operations)).toEqual({ record: RECORD, wasReplacement: false })
  })

  it('replaces the row when it exists', async () => {
    const { operations } = buildOperations({ locks: [true], inserts: [], replaces: [true] })
    expect(await upsertIntegrationRow(operations)).toEqual({ record: RECORD, wasReplacement: true })
  })

  it('a concurrent insert that won the unique key turns this call into a replacement', async () => {
    const { operations } = buildOperations({ locks: [false, true], inserts: [false], replaces: [true] })
    expect(await upsertIntegrationRow(operations)).toEqual({ record: RECORD, wasReplacement: true })
  })

  it('a concurrent DELETE after the insert conflict retries the insert once and creates the row', async () => {
    const { operations, calls } = buildOperations({ locks: [false, false], inserts: [false, true], replaces: [] })
    expect(await upsertIntegrationRow(operations)).toEqual({ record: RECORD, wasReplacement: false })
    expect(calls).toEqual(['lock', 'insert', 'lock', 'insert'])
  })

  it('a row that vanishes between lock and replace is retried, never a generic error', async () => {
    const { operations } = buildOperations({ locks: [true, false], inserts: [true], replaces: [false] })
    expect(await upsertIntegrationRow(operations)).toEqual({ record: RECORD, wasReplacement: false })
  })

  it('gives up with a 409 domain error after a second lost race', async () => {
    const { operations } = buildOperations({ locks: [false, false], inserts: [false, false], replaces: [] })
    const caught = await upsertIntegrationRow(operations).then(
      () => undefined,
      (error: unknown) => error,
    )
    expect(caught).toBeInstanceOf(InfraIntegrationConcurrentChangeError)
    expect((caught as InfraIntegrationConcurrentChangeError).statusCode).toBe(409)
  })
})
