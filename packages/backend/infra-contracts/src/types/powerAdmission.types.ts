/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraOperationRecord, PowerEnvironmentParams } from './infraOperation.types'
import type { InfraGatewayInterface } from './infraGateway.interface'
import type { InfraEnvironment, InfraProject } from './infraInventory.types'

export type AdmitParams = {
  readonly params: PowerEnvironmentParams
  readonly gateway: InfraGatewayInterface
}

export type Admission = {
  readonly project: InfraProject
  readonly environment: InfraEnvironment
  readonly keepOnUntilChange: Date | null | undefined
  readonly lockOwner: string
}

export type RegisterParams = Pick<Admission, 'project' | 'keepOnUntilChange' | 'lockOwner'> & {
  readonly params: PowerEnvironmentParams
}

export type DispatchParams = {
  readonly params: PowerEnvironmentParams
  readonly admission: Admission
  readonly operation: InfraOperationRecord
  readonly gateway: InfraGatewayInterface
}
