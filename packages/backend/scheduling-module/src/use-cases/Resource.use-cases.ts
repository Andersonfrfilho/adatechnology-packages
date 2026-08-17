/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * CRUD de recurso (spec §9) — molde de `Booking.use-cases.ts`: mesma injeção de
 * `SchedulingDependencies`, mesmo mapeamento de linha para contrato via `shared/toContract.ts`.
 */

import {
  ResourceNotFoundError,
  type CreateResourceInput,
  type ListResourcesParams,
  type PaginatedResponse,
  type Resource,
  type UpdateResourceInput,
} from '@adatechnology/scheduling-contracts'

import { toResource } from '../shared/toContract'
import type { SchedulingDependencies } from './schedulingModule.types'

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 20

export class CreateResourceUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: { companyId: string; input: CreateResourceInput }): Promise<Resource> {
    const row = await this.dependencies.repositories.resources.create({
      companyId: params.companyId,
      name: params.input.name,
      kind: params.input.kind,
      timezone: params.input.timezone,
      externalRef: params.input.externalRef ?? null,
    })
    return toResource(row)
  }
}

export class UpdateResourceUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: { companyId: string; id: string; input: UpdateResourceInput }): Promise<Resource> {
    const row = await this.dependencies.repositories.resources.update({
      companyId: params.companyId,
      id: params.id,
      values: {
        ...(params.input.name !== undefined && { name: params.input.name }),
        ...(params.input.kind !== undefined && { kind: params.input.kind }),
        ...(params.input.timezone !== undefined && { timezone: params.input.timezone }),
        ...(params.input.externalRef !== undefined && { externalRef: params.input.externalRef }),
        ...(params.input.active !== undefined && { active: params.input.active }),
      },
    })
    if (!row) throw new ResourceNotFoundError(params.id)
    return toResource(row)
  }
}

export class DeleteResourceUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: { companyId: string; id: string }): Promise<void> {
    const deleted = await this.dependencies.repositories.resources.softDelete(params)
    if (!deleted) throw new ResourceNotFoundError(params.id)
  }
}

export class GetResourceUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: { companyId: string; id: string }): Promise<Resource> {
    const row = await this.dependencies.repositories.resources.findById(params)
    if (!row) throw new ResourceNotFoundError(params.id)
    return toResource(row)
  }
}

export class ListResourcesUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: ListResourcesParams): Promise<PaginatedResponse<Resource>> {
    const page = params.page ?? DEFAULT_PAGE
    const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE

    const { rows, total } = await this.dependencies.repositories.resources.list({
      companyId: params.companyId,
      page,
      pageSize,
      kind: params.kind,
      active: params.active,
    })

    return {
      data: rows.map(toResource),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  }
}
