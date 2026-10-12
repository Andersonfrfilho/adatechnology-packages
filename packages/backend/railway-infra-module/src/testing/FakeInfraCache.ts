/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraCacheInterface } from '@adatechnology/railway-infra-contracts'
import type {
  ReleaseIfOwnerParams,
  RenewIfOwnerParams,
  SetIfAbsentParams,
} from '@adatechnology/railway-infra-contracts'

export class FakeInfraCache implements InfraCacheInterface {
  readonly store = new Map<string, string>()
  readonly setIfAbsentCalls: SetIfAbsentParams[] = []
  readonly setCalls: { readonly key: string; readonly ttlSeconds: number | undefined }[] = []
  readonly deletedKeys: string[] = []
  readonly renewCalls: RenewIfOwnerParams[] = []
  readonly releaseCalls: ReleaseIfOwnerParams[] = []

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.setCalls.push({ key, ttlSeconds })
    this.store.set(key, value)
  }

  async setIfAbsent(params: SetIfAbsentParams): Promise<boolean> {
    this.setIfAbsentCalls.push(params)
    if (this.store.has(params.key)) return false
    this.store.set(params.key, params.value)
    return true
  }

  async renewIfOwner(params: RenewIfOwnerParams): Promise<boolean> {
    this.renewCalls.push(params)
    return this.store.get(params.key) === params.owner
  }

  async releaseIfOwner(params: ReleaseIfOwnerParams): Promise<boolean> {
    this.releaseCalls.push(params)
    if (this.store.get(params.key) !== params.owner) return false
    this.store.delete(params.key)
    return true
  }

  /** Simula o TTL vencendo: a chave some sem passar por `delete`. */
  expire(key: string): void {
    this.store.delete(key)
  }

  async delete(key: string): Promise<void> {
    this.deletedKeys.push(key)
    this.store.delete(key)
  }
}
