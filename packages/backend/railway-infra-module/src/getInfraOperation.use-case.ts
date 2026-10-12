/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { InfraOperationNotFoundError } from '@adatechnology/railway-infra-contracts'
import type { GetInfraOperationParams, GetInfraOperationResult } from '@adatechnology/railway-infra-contracts'
import type { InfraOperationRepositoryInterface } from '@adatechnology/railway-infra-contracts'

type Dependencies = {
  readonly operationRepository: InfraOperationRepositoryInterface
}

/** Projeta so o que o painel precisa: ator e projeto do Railway ficam no banco. */
export class GetInfraOperationUseCase {
  constructor(private readonly dependencies: Dependencies) {}

  async execute({ operationId }: GetInfraOperationParams): Promise<GetInfraOperationResult> {
    const operation = await this.dependencies.operationRepository.findById(operationId)
    if (!operation) throw new InfraOperationNotFoundError()

    return {
      id: operation.id,
      kind: operation.kind,
      status: operation.status,
      trigger: operation.trigger,
      serviceResults: operation.serviceResults,
      startedAt: operation.startedAt,
      finishedAt: operation.finishedAt,
      railwayEnvironmentId: operation.railwayEnvironmentId,
    }
  }
}
