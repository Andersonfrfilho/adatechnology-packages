/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraSecretKey } from '../infraSecretKey'

export type SealSecretParams = {
  readonly plaintext: string
  readonly key: InfraSecretKey
  readonly provider: string
  readonly workspaceId: string
}

export type OpenSecretParams = {
  readonly sealed: string
  readonly key: InfraSecretKey
  readonly provider: string
  readonly workspaceId: string
}
