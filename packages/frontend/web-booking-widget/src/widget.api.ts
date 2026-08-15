/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import { WidgetRequestError, getApiErrorCode, toRetryAfterSeconds } from './widget.error'
import { toBookingResult, toResources, toServices, toSlots } from './widget.mapper'
import { WIDGET_PATH } from './widget.constant'
import type {
  ListAvailabilityParams,
  ListResourcesParams,
  RequestBookingParams,
  WidgetApiParams,
  WidgetBookingResult,
  WidgetResource,
  WidgetService,
  WidgetSlot,
} from './types/widget.types'

/**
 * Sucesso responde `{ data }`; erro responde `{ error: { code, message } }` (`apis.md`).
 *
 * O corpo do erro é lido com `catch` próprio porque nem toda falha vem da API do produto: um 502 de
 * proxy chega como HTML, e um `json()` que estoura ali apagaria o status, que é o único sinal restante.
 */
async function readData(response: Response): Promise<unknown> {
  if (!response.ok) {
    const failure: unknown = await response.json().catch(() => undefined)

    throw new WidgetRequestError({
      status: response.status,
      code: getApiErrorCode(failure),
      retryAfterSeconds: toRetryAfterSeconds(response.headers.get('Retry-After')),
    })
  }

  const body: unknown = await response.json()

  return typeof body === 'object' && body !== null && 'data' in body ? body.data : undefined
}

/**
 * Cliente das rotas do widget, amarrado à origem que o host configurou.
 *
 * A origem chega de fora porque muda por ambiente, e são rotas da **API do produto** — nunca do
 * `scheduling-module` diretamente (spec Q2): quem decide autenticação, rate limit e captcha na
 * borda é o produto que serve estas rotas.
 */
export class WidgetApi {
  readonly #baseUrl: string

  constructor({ baseUrl }: WidgetApiParams) {
    this.#baseUrl = baseUrl.replace(/\/+$/, '')
  }

  async listServices(): Promise<readonly WidgetService[]> {
    const response = await fetch(`${this.#baseUrl}${WIDGET_PATH.SERVICES}`)

    return toServices(await readData(response))
  }

  async listResources({ serviceId }: ListResourcesParams): Promise<readonly WidgetResource[]> {
    const response = await fetch(`${this.#baseUrl}${WIDGET_PATH.RESOURCES(serviceId)}`)

    return toResources(await readData(response))
  }

  async listAvailability(params: ListAvailabilityParams): Promise<readonly WidgetSlot[]> {
    const response = await fetch(`${this.#baseUrl}${WIDGET_PATH.AVAILABILITY(params)}`)

    return toSlots(await readData(response))
  }

  async requestBooking(params: RequestBookingParams): Promise<WidgetBookingResult> {
    const response = await fetch(`${this.#baseUrl}${WIDGET_PATH.BOOKINGS}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        serviceId: params.serviceId,
        resourceId: params.resourceId,
        startsAt: params.slot.startsAt,
        endsAt: params.slot.endsAt,
        customerName: params.customerName,
        customerContact: params.customerContact,
      }),
    })

    return toBookingResult(await readData(response))
  }
}
