/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { openSecret } from './infraSecretCipher'
import { InfraSecretUnreadableError } from '@adatechnology/railway-infra-contracts'
import { loadInfraSecretKey } from './infraSecretKey'
import { INFRA_INTEGRATION_STATE } from '@adatechnology/railway-infra-contracts'
import type { InfraSecretKey } from './infraSecretKey'
import type { InfraIntegrationRecord } from '@adatechnology/railway-infra-contracts'
import type { InfraIntegrationState } from '@adatechnology/railway-infra-contracts'

export type PanelCredentialResolution = {
  readonly state: InfraIntegrationState
  readonly token?: string
  readonly unreadableReason?: string
}

export type ResolvePanelCredentialParams = {
  readonly record: InfraIntegrationRecord
  readonly workspaceId: string
  readonly encryptionKeyBase64: string
}

function tryLoadKey(encryptionKeyBase64: string): InfraSecretKey | undefined {
  if (encryptionKeyBase64.length === 0) return undefined
  try {
    return loadInfraSecretKey(encryptionKeyBase64)
  } catch {
    return undefined
  }
}

/** Fail closed: qualquer divergência devolve um estado sem token, nunca outra credencial. */
export function resolvePanelCredential(params: ResolvePanelCredentialParams): PanelCredentialResolution {
  const { record } = params
  const key = tryLoadKey(params.encryptionKeyBase64)
  if (!key) return { state: INFRA_INTEGRATION_STATE.KEY_MISSING }
  if (record.keyId !== key.keyId) return { state: INFRA_INTEGRATION_STATE.KEY_MISMATCH }
  if (record.workspaceId !== params.workspaceId) return { state: INFRA_INTEGRATION_STATE.WORKSPACE_MISMATCH }
  try {
    const token = openSecret({
      sealed: record.ciphertext,
      key,
      provider: record.provider,
      workspaceId: record.workspaceId,
    })
    return { state: INFRA_INTEGRATION_STATE.CONFIGURED, token }
  } catch (error) {
    const unreadableReason = error instanceof InfraSecretUnreadableError ? error.reason : 'unknown'
    return { state: INFRA_INTEGRATION_STATE.SECRET_UNREADABLE, unreadableReason }
  }
}
