/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  AVAILABILITY_EXCEPTION_KIND,
  AvailabilityExceptionNotFoundError,
  ResourceNotFoundError,
  ResourceUnavailableError,
  ServiceNotFoundError,
  ServiceNotOfferedByResourceError,
  type AvailabilityException,
  type AvailabilityRule,
  type AvailableSlot,
  type CreateAvailabilityExceptionInput,
  type CreateAvailabilityRuleInput,
  type GetAvailabilityParams,
} from '@adatechnology/scheduling-contracts'

import { resolveLocalInstantsKey } from '../repositories/AvailabilityRepository'
import type { AvailabilityExceptionRow, AvailabilityRuleRow } from '../schema/schema'
import { toAvailabilityException, toAvailabilityRule } from '../shared/toContract'
import {
  formatLocalDate,
  localDateRange,
  sliceIntoSteps,
  validateLookaheadWindow,
  weekdayOfLocalDate,
  windowsOverlap,
  type AvailabilityCandidate,
  type TimeWindow,
} from './availabilitySlicing'
import type { SchedulingDependencies } from './schedulingModule.types'

/**
 * Fórmula da spec §7: fatias das regras semanais na janela, menos exceção `block`, mais exceção
 * `extra`, menos `blocking` de reserva existente. Calculado em leitura — nunca materializa slot.
 */
export class ListAvailableSlotsUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: GetAvailabilityParams): Promise<AvailableSlot[]> {
    validateLookaheadWindow({
      from: params.from,
      until: params.until,
      maxLookaheadDays: this.dependencies.config.maxLookaheadDays,
    })

    const { resources, services, availability, bookings } = this.dependencies.repositories

    const resource = await resources.findById({ companyId: params.companyId, id: params.resourceId })
    if (!resource) throw new ResourceNotFoundError(params.resourceId)
    if (!resource.active) throw new ResourceUnavailableError(params.resourceId)

    const service = await services.findById({ companyId: params.companyId, id: params.serviceId })
    if (!service) throw new ServiceNotFoundError(params.serviceId)

    const offeredResourceIds = await services.listResourceIdsForService({
      companyId: params.companyId,
      serviceId: params.serviceId,
    })
    if (!offeredResourceIds.includes(params.resourceId)) {
      throw new ServiceNotOfferedByResourceError(params.resourceId, params.serviceId)
    }

    const [rules, exceptions, blockingSlots] = await Promise.all([
      availability.listRulesByResource({ companyId: params.companyId, resourceId: params.resourceId }),
      availability.listExceptionsByResourceInRange({
        companyId: params.companyId,
        resourceId: params.resourceId,
        from: params.from,
        until: params.until,
      }),
      bookings.listBlockingSlotsByResource({ resourceId: params.resourceId, from: params.from, until: params.until }),
    ])

    const ruleCandidates = await this.candidatesFromRules({
      companyId: params.companyId,
      resourceId: params.resourceId,
      timezone: resource.timezone,
      from: params.from,
      until: params.until,
      durationMinutes: service.durationMinutes,
      bufferBeforeMinutes: service.bufferBeforeMinutes,
      bufferAfterMinutes: service.bufferAfterMinutes,
      rules,
    })
    const extraCandidates = candidatesFromExtraExceptions({
      exceptions,
      durationMinutes: service.durationMinutes,
      bufferBeforeMinutes: service.bufferBeforeMinutes,
      bufferAfterMinutes: service.bufferAfterMinutes,
    })

    const blockWindows = exceptions
      .filter((exception) => exception.kind === AVAILABILITY_EXCEPTION_KIND.BLOCK)
      .map((exception): TimeWindow => ({ start: exception.duringStart, end: exception.duringEnd }))
    const bookedWindows = blockingSlots.map(
      (slot): TimeWindow => ({ start: slot.blockingStart, end: slot.blockingEnd }),
    )

    // F-014: segunda barreira contra candidato fora da janela pedida — mesmo que uma exceção
    // `extra` chegue aqui sem filtro (bug de outro caminho, driver diferente, chamada direta do
    // repositório), nenhum candidato fora de `[from, until)` sai deste método.
    const requestedWindow: TimeWindow = { start: params.from, end: params.until }
    const free = [...ruleCandidates, ...extraCandidates].filter(
      (candidate) =>
        windowsOverlap(candidate.during, requestedWindow) &&
        !blockWindows.some((window) => windowsOverlap(candidate.blocking, window)) &&
        !bookedWindows.some((window) => windowsOverlap(candidate.blocking, window)),
    )

    return free
      .sort((a, b) => a.during.start.getTime() - b.during.start.getTime())
      .map((candidate) => ({
        resourceId: params.resourceId,
        serviceId: params.serviceId,
        startsAt: candidate.during.start,
        endsAt: candidate.during.end,
      }))
  }

  /**
   * Uma data local × uma regra do mesmo dia da semana = um instante resolvido pelo fuso do recurso
   * (T3.2). F-008: início e fim de toda ocorrência da janela inteira resolvem numa única viagem ao
   * banco (`resolveLocalInstants`) — antes eram 2 idas ao Postgres por ocorrência (N+1).
   */
  private async candidatesFromRules(params: {
    companyId: string
    resourceId: string
    timezone: string
    from: Date
    until: Date
    durationMinutes: number
    bufferBeforeMinutes: number
    bufferAfterMinutes: number
    rules: readonly AvailabilityRuleRow[]
  }): Promise<AvailabilityCandidate[]> {
    const { availability } = this.dependencies.repositories
    const dates = localDateRange({ from: params.from, until: params.until, timezone: params.timezone })

    const occurrences = dates.flatMap((date) => {
      const weekday = weekdayOfLocalDate(date)
      return params.rules.filter((rule) => rule.weekday === weekday).map((rule) => ({ date, rule }))
    })

    const instants = await availability.resolveLocalInstants({
      companyId: params.companyId,
      resourceId: params.resourceId,
      occurrences: occurrences.flatMap(({ date, rule }) => [
        { localDate: formatLocalDate(date), localTime: rule.startsAtLocal },
        { localDate: formatLocalDate(date), localTime: rule.endsAtLocal },
      ]),
    })

    return occurrences.flatMap(({ date, rule }) =>
      this.resolveRuleOccurrence({
        date,
        rule,
        durationMinutes: params.durationMinutes,
        bufferBeforeMinutes: params.bufferBeforeMinutes,
        bufferAfterMinutes: params.bufferAfterMinutes,
        instants,
      }),
    )
  }

  private resolveRuleOccurrence(params: {
    date: { year: number; month: number; day: number }
    rule: AvailabilityRuleRow
    durationMinutes: number
    bufferBeforeMinutes: number
    bufferAfterMinutes: number
    instants: Map<string, Date>
  }): AvailabilityCandidate[] {
    const localDate = formatLocalDate(params.date)
    const start = params.instants.get(resolveLocalInstantsKey({ localDate, localTime: params.rule.startsAtLocal }))
    const end = params.instants.get(resolveLocalInstantsKey({ localDate, localTime: params.rule.endsAtLocal }))
    if (!start || !end) {
      throw new Error('scheduling-module: instante local não resolvido para a ocorrência da regra')
    }

    // T3.4: regra fora da validade nesta ocorrência não gera candidato — histórico do que valia
    // antes fica intacto, e o que passa a valer numa data futura não vaza para trás.
    if (params.rule.validFrom && start < params.rule.validFrom) return []
    if (params.rule.validUntil && end > params.rule.validUntil) return []

    return sliceIntoSteps({
      window: { start, end },
      durationMinutes: params.durationMinutes,
      bufferBeforeMinutes: params.bufferBeforeMinutes,
      bufferAfterMinutes: params.bufferAfterMinutes,
    })
  }
}

function candidatesFromExtraExceptions(params: {
  exceptions: readonly AvailabilityExceptionRow[]
  durationMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
}): AvailabilityCandidate[] {
  return params.exceptions
    .filter((exception) => exception.kind === AVAILABILITY_EXCEPTION_KIND.EXTRA)
    .flatMap((exception) =>
      sliceIntoSteps({
        window: { start: exception.duringStart, end: exception.duringEnd },
        durationMinutes: params.durationMinutes,
        bufferBeforeMinutes: params.bufferBeforeMinutes,
        bufferAfterMinutes: params.bufferAfterMinutes,
      }),
    )
}

/** Substitui a grade semanal inteira do recurso — molde de `RescheduleBookingUseCase` (troca atômica). */
export class SetAvailabilityRulesUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: {
    companyId: string
    resourceId: string
    rules: ReadonlyArray<Omit<CreateAvailabilityRuleInput, 'resourceId'>>
  }): Promise<AvailabilityRule[]> {
    const { resources, availability } = this.dependencies.repositories

    const resource = await resources.findById({ companyId: params.companyId, id: params.resourceId })
    if (!resource) throw new ResourceNotFoundError(params.resourceId)

    const rows = await availability.replaceRules({
      companyId: params.companyId,
      resourceId: params.resourceId,
      rules: params.rules.map((rule) => ({
        weekday: rule.weekday,
        startsAtLocal: rule.startsAtLocal,
        endsAtLocal: rule.endsAtLocal,
        validFrom: rule.validFrom ?? null,
        validUntil: rule.validUntil ?? null,
      })),
    })

    return rows.map(toAvailabilityRule)
  }
}

/** Leitura da grade semanal vigente do recurso. */
export class ListAvailabilityRulesUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: { companyId: string; resourceId: string }): Promise<AvailabilityRule[]> {
    const { resources, availability } = this.dependencies.repositories

    const resource = await resources.findById({ companyId: params.companyId, id: params.resourceId })
    if (!resource) throw new ResourceNotFoundError(params.resourceId)

    const rows = await availability.listRulesByResource(params)
    return rows.map(toAvailabilityRule)
  }
}

/** Bloqueio (`block`) ou encaixe pontual (`extra`) fora da grade semanal (spec §7). */
export class AddAvailabilityExceptionUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: {
    companyId: string
    input: CreateAvailabilityExceptionInput
  }): Promise<AvailabilityException> {
    const { resources, availability } = this.dependencies.repositories

    const resource = await resources.findById({ companyId: params.companyId, id: params.input.resourceId })
    if (!resource) throw new ResourceNotFoundError(params.input.resourceId)

    const row = await availability.createException({
      companyId: params.companyId,
      resourceId: params.input.resourceId,
      duringStart: params.input.during.start,
      duringEnd: params.input.during.end,
      kind: params.input.kind,
      reason: params.input.reason ?? null,
    })

    return toAvailabilityException(row)
  }
}

/** Leitura das exceções vigentes do recurso. */
export class ListAvailabilityExceptionsUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: { companyId: string; resourceId: string }): Promise<AvailabilityException[]> {
    const { resources, availability } = this.dependencies.repositories

    const resource = await resources.findById({ companyId: params.companyId, id: params.resourceId })
    if (!resource) throw new ResourceNotFoundError(params.resourceId)

    const rows = await availability.listExceptionsByResourceInRange(params)
    return rows.map(toAvailabilityException)
  }
}

/** Remove uma exceção — id + empresa bastam (BOLA, `authorization.md`): nunca vaza 403 para outra empresa. */
export class RemoveAvailabilityExceptionUseCase {
  constructor(private readonly dependencies: SchedulingDependencies) {}

  async execute(params: { companyId: string; id: string }): Promise<void> {
    const deleted = await this.dependencies.repositories.availability.deleteException(params)
    if (!deleted) throw new AvailabilityExceptionNotFoundError(params.id)
  }
}
