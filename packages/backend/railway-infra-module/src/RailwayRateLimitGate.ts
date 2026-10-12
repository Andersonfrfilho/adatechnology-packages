/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { RailwayRateLimitedError } from '@adatechnology/railway-infra-contracts'
import { resolveRateLimitWaitSeconds } from './resolveRateLimitWaitSeconds'

const MILLISECONDS_PER_SECOND = 1000

/** Depois de um 429, nenhuma chamada sai ate o `Retry-After`: insistir so prolonga o bloqueio. */
export class RailwayRateLimitGate {
  private blockedUntilMilliseconds = 0

  constructor(private readonly now: () => number) {}

  assertNotBlocked(): void {
    // Enquanto o Railway pede espera, nao ha motivo para gastar uma chamada que ele vai recusar.
    const remainingMilliseconds = this.blockedUntilMilliseconds - this.now()
    if (remainingMilliseconds <= 0) return

    throw new RailwayRateLimitedError(Math.ceil(remainingMilliseconds / MILLISECONDS_PER_SECOND))
  }

  blockAfterRateLimit(headers: Headers): RailwayRateLimitedError {
    const nowMilliseconds = this.now()
    const { seconds } = resolveRateLimitWaitSeconds({ headers, nowMilliseconds })
    this.blockedUntilMilliseconds = nowMilliseconds + seconds * MILLISECONDS_PER_SECOND

    return new RailwayRateLimitedError(seconds)
  }
}
