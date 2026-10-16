/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { StonePosErrorCode } from './types'

export class StonePosError extends Error {
  readonly code: StonePosErrorCode
  readonly rawUri: string | undefined

  constructor(code: StonePosErrorCode, message: string, rawUri?: string) {
    super(message)
    this.name = 'StonePosError'
    this.code = code
    this.rawUri = rawUri
  }
}
