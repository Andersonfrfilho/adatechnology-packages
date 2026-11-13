/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ReleaseIfOwnerParams, RenewIfOwnerParams, SetIfAbsentParams } from './infraCache.types'

export interface InfraCacheInterface {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds?: number): Promise<void>
  /** SET NX com TTL: devolve `true` só para quem criou a chave. */
  setIfAbsent(params: SetIfAbsentParams): Promise<boolean>
  /** Compare-and-expire atômico: só estende o TTL se o valor da chave ainda for `owner`. */
  renewIfOwner(params: RenewIfOwnerParams): Promise<boolean>
  /** Compare-and-delete atômico: só apaga se o valor da chave ainda for `owner`. */
  releaseIfOwner(params: ReleaseIfOwnerParams): Promise<boolean>
  delete(key: string): Promise<void>
}
