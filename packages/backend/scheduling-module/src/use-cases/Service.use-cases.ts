/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * CRUD de serviço e vínculo com recurso (spec §9) — molde de `Resource.use-cases.ts`. Vínculo
 * valida que os dois lados pertencem à mesma empresa antes de gravar: a FK de
 * `resource_services` não garante isso sozinha, porque `resourceId`/`serviceId` não carregam o
 * tenant na própria constraint (spec §5.3/BOLA, `code-standart.md` §8).
 */

import {
  ResourceNotFoundError,
  ServiceNotFoundError,
  type CreateServiceInput,
  type ListServicesParams,
  type PaginatedResponse,
  type Service,
  type UpdateServiceInput,
} from '@adatechnology/scheduling-contracts'

import { toService } from '../shared/toContract'
import type { SchedulingDependencies } from './schedulingModule.types'

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 20

export class CreateServiceUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: { companyId: string; input: CreateServiceInput }): Promise<Service> {
    const row = await this.dependencies.repositories.services.create({
      companyId: params.companyId,
      name: params.input.name,
      description: params.input.description ?? null,
      durationMinutes: params.input.durationMinutes,
      bufferBeforeMinutes: params.input.bufferBeforeMinutes ?? 0,
      bufferAfterMinutes: params.input.bufferAfterMinutes ?? 0,
      priceInCents: params.input.priceInCents ?? null,
      requiresConfirmation: params.input.requiresConfirmation ?? false,
      minCancellationNoticeMinutes: params.input.minCancellationNoticeMinutes ?? 0,
      sortOrder: params.input.sortOrder ?? 0,
    })
    return toService(row)
  }
}

export class UpdateServiceUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: { companyId: string; id: string; input: UpdateServiceInput }): Promise<Service> {
    const row = await this.dependencies.repositories.services.update({
      companyId: params.companyId,
      id: params.id,
      values: {
        ...(params.input.name !== undefined && { name: params.input.name }),
        ...(params.input.description !== undefined && { description: params.input.description }),
        ...(params.input.durationMinutes !== undefined && { durationMinutes: params.input.durationMinutes }),
        ...(params.input.bufferBeforeMinutes !== undefined && {
          bufferBeforeMinutes: params.input.bufferBeforeMinutes,
        }),
        ...(params.input.bufferAfterMinutes !== undefined && { bufferAfterMinutes: params.input.bufferAfterMinutes }),
        ...(params.input.priceInCents !== undefined && { priceInCents: params.input.priceInCents }),
        ...(params.input.requiresConfirmation !== undefined && {
          requiresConfirmation: params.input.requiresConfirmation,
        }),
        ...(params.input.minCancellationNoticeMinutes !== undefined && {
          minCancellationNoticeMinutes: params.input.minCancellationNoticeMinutes,
        }),
        ...(params.input.sortOrder !== undefined && { sortOrder: params.input.sortOrder }),
        ...(params.input.active !== undefined && { active: params.input.active }),
      },
    })
    if (!row) throw new ServiceNotFoundError(params.id)
    return toService(row)
  }
}

export class DeleteServiceUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: { companyId: string; id: string }): Promise<void> {
    const deleted = await this.dependencies.repositories.services.softDelete(params)
    if (!deleted) throw new ServiceNotFoundError(params.id)
  }
}

export class GetServiceUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: { companyId: string; id: string }): Promise<Service> {
    const row = await this.dependencies.repositories.services.findById(params)
    if (!row) throw new ServiceNotFoundError(params.id)
    return toService(row)
  }
}

export class ListServicesUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: ListServicesParams): Promise<PaginatedResponse<Service>> {
    const page = params.page ?? DEFAULT_PAGE
    const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE

    const { rows, total } = await this.dependencies.repositories.services.list({
      companyId: params.companyId,
      page,
      pageSize,
      active: params.active,
    })

    return {
      data: rows.map(toService),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  }
}

async function assertServiceAndResourceOwned(params: {
  dependencies: SchedulingDependencies
  companyId: string
  serviceId: string
  resourceId: string
}): Promise<void> {
  const { resources, services } = params.dependencies.repositories
  const [resource, service] = await Promise.all([
    resources.findById({ companyId: params.companyId, id: params.resourceId }),
    services.findById({ companyId: params.companyId, id: params.serviceId }),
  ])
  if (!resource) throw new ResourceNotFoundError(params.resourceId)
  if (!service) throw new ServiceNotFoundError(params.serviceId)
}

export class LinkResourceToServiceUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: { companyId: string; serviceId: string; resourceId: string }): Promise<void> {
    await assertServiceAndResourceOwned({ dependencies: this.dependencies, ...params })
    await this.dependencies.repositories.services.linkResource({
      companyId: params.companyId,
      resourceId: params.resourceId,
      serviceId: params.serviceId,
    })
  }
}

export class UnlinkResourceFromServiceUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: { companyId: string; serviceId: string; resourceId: string }): Promise<void> {
    await assertServiceAndResourceOwned({ dependencies: this.dependencies, ...params })
    await this.dependencies.repositories.services.unlinkResource(params)
  }
}
