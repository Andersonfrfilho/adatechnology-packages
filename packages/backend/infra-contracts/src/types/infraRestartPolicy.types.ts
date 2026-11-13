/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraRestartPolicyType } from '../infraRestartPolicy.constant'

export type InfraRestartPolicy = {
  readonly type: InfraRestartPolicyType
  readonly maxRetries?: number
}

export type InfraServiceReference = {
  readonly environmentId: string
  readonly serviceId: string
}

export type SetRestartPolicyParams = InfraServiceReference & {
  readonly policy: InfraRestartPolicy
}

/** Onde o desligamento guarda a política original do serviço, para o ligar devolvê-la. */
export interface InfraRestartPolicyStoreInterface {
  get(reference: InfraServiceReference): Promise<InfraRestartPolicy | undefined>
  save(reference: InfraServiceReference, policy: InfraRestartPolicy): Promise<void>
  delete(reference: InfraServiceReference): Promise<void>
}
