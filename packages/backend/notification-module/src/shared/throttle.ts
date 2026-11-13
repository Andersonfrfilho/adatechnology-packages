/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Sem `CachePort` injetado, throttle fica desligado — e é isto, não uma exceção, que a ausência
 * de cache produz (spec §10, regra 8: "cachear é decisão do host").
 */

import type { CachePort } from '@adatechnology/notification-contracts'

const THROTTLE_WINDOW_SECONDS = 3600

export async function isThrottled(params: {
  readonly cache?: CachePort
  readonly companyId: string
  readonly userId: string
  readonly channel: string
  readonly limitPerHour: number
}): Promise<boolean> {
  if (!params.cache) return false

  const key = `notification:throttle:${params.companyId}:${params.userId}:${params.channel}`
  const count = await params.cache.increment({ key, ttlSeconds: THROTTLE_WINDOW_SECONDS })
  return count > params.limitPerHour
}
