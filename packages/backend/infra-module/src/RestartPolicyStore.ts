/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { z } from 'zod'

import {
  INFRA_RESTART_POLICY_KEY_PREFIX,
  INFRA_RESTART_POLICY_TTL_SECONDS,
  INFRA_RESTART_POLICY_TYPE,
} from '@adatechnology/infra-contracts'
import type {
  InfraCacheInterface,
  InfraRestartPolicy,
  InfraRestartPolicyStoreInterface,
  InfraServiceReference,
} from '@adatechnology/infra-contracts'

const storedPolicySchema = z.object({
  type: z.nativeEnum(INFRA_RESTART_POLICY_TYPE),
  maxRetries: z.number().int().optional(),
})

function keyOf(reference: InfraServiceReference): string {
  return `${INFRA_RESTART_POLICY_KEY_PREFIX}${reference.environmentId}:${reference.serviceId}`
}

/** Guarda a política original no cache do host. Valor ilegível conta como ausente: o ligar não chuta. */
export class RestartPolicyStore implements InfraRestartPolicyStoreInterface {
  constructor(private readonly cache: InfraCacheInterface) {}

  async get(reference: InfraServiceReference): Promise<InfraRestartPolicy | undefined> {
    const raw = await this.cache.get(keyOf(reference))
    if (raw === null) return undefined
    try {
      return storedPolicySchema.parse(JSON.parse(raw))
    } catch {
      return undefined
    }
  }

  async save(reference: InfraServiceReference, policy: InfraRestartPolicy): Promise<void> {
    await this.cache.set(keyOf(reference), JSON.stringify(policy), INFRA_RESTART_POLICY_TTL_SECONDS)
  }

  async delete(reference: InfraServiceReference): Promise<void> {
    await this.cache.delete(keyOf(reference))
  }
}
