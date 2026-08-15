/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import type { WidgetBookingResult, WidgetResource, WidgetService, WidgetSlot } from './types/widget.types'

/**
 * A resposta da rota é entrada não confiável, mesmo vindo da API do produto.
 *
 * O widget é distribuído para rodar em qualquer host: uma rota que mudou de formato não pode
 * derrubar a tela do visitante — só faz o item correspondente desaparecer da lista.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toRows(payload: unknown): readonly unknown[] {
  return Array.isArray(payload) ? payload : []
}

export function toService(value: unknown): WidgetService | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return undefined
  if (typeof value.durationMinutes !== 'number') return undefined

  return {
    id: value.id,
    name: value.name,
    description: typeof value.description === 'string' ? value.description : null,
    durationMinutes: value.durationMinutes,
    priceInCents: typeof value.priceInCents === 'number' ? value.priceInCents : null,
  }
}

export function toServices(payload: unknown): readonly WidgetService[] {
  return toRows(payload)
    .map(toService)
    .filter((service): service is WidgetService => service !== undefined)
}

export function toResource(value: unknown): WidgetResource | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.timezone !== 'string')
    return undefined

  return { id: value.id, name: value.name, timezone: value.timezone }
}

export function toResources(payload: unknown): readonly WidgetResource[] {
  return toRows(payload)
    .map(toResource)
    .filter((resource): resource is WidgetResource => resource !== undefined)
}

export function toSlot(value: unknown): WidgetSlot | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.resourceId !== 'string' || typeof value.startsAt !== 'string' || typeof value.endsAt !== 'string')
    return undefined

  return { resourceId: value.resourceId, startsAt: value.startsAt, endsAt: value.endsAt }
}

export function toSlots(payload: unknown): readonly WidgetSlot[] {
  return toRows(payload)
    .map(toSlot)
    .filter((slot): slot is WidgetSlot => slot !== undefined)
}

export function toBookingResult(payload: unknown): WidgetBookingResult {
  if (!isRecord(payload) || typeof payload.bookingId !== 'string') {
    throw new Error('booking widget response has no bookingId')
  }

  return {
    bookingId: payload.bookingId,
    status: typeof payload.status === 'string' ? payload.status : '',
  }
}
