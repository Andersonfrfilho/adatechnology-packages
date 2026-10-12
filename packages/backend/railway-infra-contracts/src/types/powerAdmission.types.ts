/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraOperationRecord, PowerEnvironmentParams } from './infraOperation.types'
import type { RailwayGatewayInterface } from './railwayGateway.interface'
import type { RailwayEnvironment, RailwayProject } from './railwayInventory.types'

export type AdmitParams = {
  readonly params: PowerEnvironmentParams
  readonly railwayGateway: RailwayGatewayInterface
}

export type Admission = {
  readonly project: RailwayProject
  readonly environment: RailwayEnvironment
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
  readonly gateway: RailwayGatewayInterface
}
