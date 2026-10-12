/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { z } from 'zod'

export type ParseCachedJsonParams<TData> = {
  readonly raw: string
  readonly schema: z.ZodType<TData>
}

export type SetIfAbsentParams = {
  readonly key: string
  readonly value: string
  readonly ttlSeconds: number
}

export type RenewIfOwnerParams = {
  readonly key: string
  readonly owner: string
  readonly ttlSeconds: number
}

export type ReleaseIfOwnerParams = { readonly key: string; readonly owner: string }
