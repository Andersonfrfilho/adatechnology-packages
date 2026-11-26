/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Regras de recorrência do painel: cada regra publica, na frequência escolhida, um post novo copiado
 * de um modelo. Quem executa é o `publishDue`.
 */

import {
  createRecurrenceSchema,
  NotATemplateError,
  PostNotFoundError,
  RecurrenceNotFoundError,
  updateRecurrenceSchema,
  type CreateRecurrenceInput,
  type RecurrenceFrequency,
  type RecurrenceRule,
  type UpdateRecurrenceInput,
} from '@adatechnology/content-contracts'

import type { NewRecurrenceRow, RecurrenceRow } from '../schema/schema'
import type { ContentDependencies } from './contentModule.types'

abstract class RecurrenceUseCaseBase {
  constructor(protected readonly dependencies: ContentDependencies) {}

  protected async toRule(row: RecurrenceRow): Promise<RecurrenceRule> {
    const template = await this.dependencies.posts.findById({ companyId: row.companyId, id: row.templateId })
    return {
      id: row.id,
      companyId: row.companyId,
      templateId: row.templateId,
      templateTitle: template?.title ?? '',
      frequency: row.frequency as RecurrenceFrequency,
      isActive: row.isActive,
      nextRunAt: row.nextRunAt.toISOString(),
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      lastPostId: row.lastPostId,
      createdAt: row.createdAt.toISOString(),
    }
  }

  protected async findOrFail(params: { companyId: string; id: string }): Promise<RecurrenceRow> {
    const row = await this.dependencies.recurrences.findById(params)
    if (!row) throw new RecurrenceNotFoundError(params.id)
    return row
  }
}

export class CreateRecurrenceUseCase extends RecurrenceUseCaseBase {
  async execute(params: {
    readonly companyId: string
    readonly input: CreateRecurrenceInput
  }): Promise<RecurrenceRule> {
    const input = createRecurrenceSchema.parse(params.input)
    const template = await this.dependencies.posts.findById({ companyId: params.companyId, id: input.templateId })
    if (!template) throw new PostNotFoundError(input.templateId)
    if (!template.isTemplate) throw new NotATemplateError(input.templateId)
    const startsAt = new Date(input.startsAt)
    const values: NewRecurrenceRow = {
      companyId: params.companyId,
      templateId: input.templateId,
      frequency: input.frequency,
      anchorDay: startsAt.getUTCDate(),
      nextRunAt: startsAt,
    }
    return this.toRule(await this.dependencies.recurrences.create(values))
  }
}

export class ListRecurrencesUseCase extends RecurrenceUseCaseBase {
  async execute(params: { readonly companyId: string }): Promise<readonly RecurrenceRule[]> {
    const rows = await this.dependencies.recurrences.list(params)
    return Promise.all(rows.map((row) => this.toRule(row)))
  }
}

export class UpdateRecurrenceUseCase extends RecurrenceUseCaseBase {
  /** Pausar/retomar e remarcar a próxima execução. */
  async execute(params: {
    readonly companyId: string
    readonly id: string
    readonly input: UpdateRecurrenceInput
  }): Promise<RecurrenceRule> {
    const input = updateRecurrenceSchema.parse(params.input)
    await this.findOrFail(params)
    const values: Partial<NewRecurrenceRow> = {}
    if (input.isActive !== undefined) values.isActive = input.isActive
    if (input.nextRunAt !== undefined) {
      values.nextRunAt = new Date(input.nextRunAt)
      values.anchorDay = values.nextRunAt.getUTCDate()
    }
    const row = await this.dependencies.recurrences.update({ companyId: params.companyId, id: params.id, values })
    if (!row) throw new RecurrenceNotFoundError(params.id)
    return this.toRule(row)
  }
}

export class RemoveRecurrenceUseCase extends RecurrenceUseCaseBase {
  /** Apaga só a regra: os posts que ela já publicou continuam no ar. */
  async execute(params: { readonly companyId: string; readonly id: string }): Promise<void> {
    if (!(await this.dependencies.recurrences.remove(params))) throw new RecurrenceNotFoundError(params.id)
  }
}
