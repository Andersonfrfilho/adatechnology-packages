/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  AVAILABILITY_EXCEPTION_KIND,
  ResourceNotFoundError,
  ResourceUnavailableError,
  ServiceNotFoundError,
  ServiceNotOfferedByResourceError,
  type AvailableSlot,
  type GetAvailabilityParams,
} from '@adatechnology/scheduling-contracts'

import type { AvailabilityExceptionRow, AvailabilityRuleRow } from '../schema/schema'
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

    const stepMinutes = service.durationMinutes + service.bufferBeforeMinutes + service.bufferAfterMinutes

    const [rules, exceptions, blockingSlots] = await Promise.all([
      availability.listRulesByResource({ companyId: params.companyId, resourceId: params.resourceId }),
      availability.listExceptionsByResourceInRange({ companyId: params.companyId, resourceId: params.resourceId }),
      bookings.listBlockingSlotsByResource({ resourceId: params.resourceId, from: params.from, until: params.until }),
    ])

    const ruleCandidates = await this.candidatesFromRules({
      companyId: params.companyId,
      resourceId: params.resourceId,
      timezone: resource.timezone,
      from: params.from,
      until: params.until,
      durationMinutes: service.durationMinutes,
      stepMinutes,
      rules,
    })
    const extraCandidates = candidatesFromExtraExceptions({
      exceptions,
      durationMinutes: service.durationMinutes,
      stepMinutes,
    })

    const blockWindows = exceptions
      .filter((exception) => exception.kind === AVAILABILITY_EXCEPTION_KIND.BLOCK)
      .map((exception): TimeWindow => ({ start: exception.duringStart, end: exception.duringEnd }))
    const bookedWindows = blockingSlots.map(
      (slot): TimeWindow => ({ start: slot.blockingStart, end: slot.blockingEnd }),
    )

    const free = [...ruleCandidates, ...extraCandidates].filter(
      (candidate) =>
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

  /** Uma data local × uma regra do mesmo dia da semana = um instante resolvido pelo fuso do recurso (T3.2). */
  private async candidatesFromRules(params: {
    companyId: string
    resourceId: string
    timezone: string
    from: Date
    until: Date
    durationMinutes: number
    stepMinutes: number
    rules: readonly AvailabilityRuleRow[]
  }): Promise<AvailabilityCandidate[]> {
    const dates = localDateRange({ from: params.from, until: params.until, timezone: params.timezone })

    const perOccurrence = await Promise.all(
      dates.flatMap((date) => {
        const weekday = weekdayOfLocalDate(date)
        return params.rules
          .filter((rule) => rule.weekday === weekday)
          .map((rule) => this.resolveRuleOccurrence({ ...params, date, rule }))
      }),
    )

    return perOccurrence.flat()
  }

  private async resolveRuleOccurrence(params: {
    companyId: string
    resourceId: string
    date: { year: number; month: number; day: number }
    rule: AvailabilityRuleRow
    durationMinutes: number
    stepMinutes: number
  }): Promise<AvailabilityCandidate[]> {
    const { availability } = this.dependencies.repositories
    const [start, end] = await Promise.all([
      availability.resolveLocalInstant({
        companyId: params.companyId,
        resourceId: params.resourceId,
        localDate: formatLocalDate(params.date),
        localTime: params.rule.startsAtLocal,
      }),
      availability.resolveLocalInstant({
        companyId: params.companyId,
        resourceId: params.resourceId,
        localDate: formatLocalDate(params.date),
        localTime: params.rule.endsAtLocal,
      }),
    ])

    // T3.4: regra fora da validade nesta ocorrência não gera candidato — histórico do que valia
    // antes fica intacto, e o que passa a valer numa data futura não vaza para trás.
    if (params.rule.validFrom && start < params.rule.validFrom) return []
    if (params.rule.validUntil && end > params.rule.validUntil) return []

    return sliceIntoSteps({
      window: { start, end },
      durationMinutes: params.durationMinutes,
      stepMinutes: params.stepMinutes,
    })
  }
}

function candidatesFromExtraExceptions(params: {
  exceptions: readonly AvailabilityExceptionRow[]
  durationMinutes: number
  stepMinutes: number
}): AvailabilityCandidate[] {
  return params.exceptions
    .filter((exception) => exception.kind === AVAILABILITY_EXCEPTION_KIND.EXTRA)
    .flatMap((exception) =>
      sliceIntoSteps({
        window: { start: exception.duringStart, end: exception.duringEnd },
        durationMinutes: params.durationMinutes,
        stepMinutes: params.stepMinutes,
      }),
    )
}
