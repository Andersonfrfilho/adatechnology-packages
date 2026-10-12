/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_POWER_DIRECTION } from '@adatechnology/railway-infra-contracts'
import { PowerEnvironmentUseCase, type PowerEnvironmentDependencies } from './powerEnvironment.use-case'

export class PowerOffEnvironmentUseCase extends PowerEnvironmentUseCase {
  constructor(dependencies: PowerEnvironmentDependencies) {
    super({ ...dependencies, direction: INFRA_POWER_DIRECTION.OFF })
  }
}
