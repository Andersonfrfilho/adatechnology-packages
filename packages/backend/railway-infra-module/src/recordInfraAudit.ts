/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraAuditRecorderInterface } from '@adatechnology/railway-infra-contracts'
import type { InfraAuditEntry } from '@adatechnology/railway-infra-contracts'
import type { InfraLogger } from '@adatechnology/railway-infra-contracts'

type RecordInfraAuditParams = {
  readonly recordAudit: InfraAuditRecorderInterface
  readonly logger: InfraLogger
  readonly entry: InfraAuditEntry
}

/** Melhor esforço: falha de auditoria é logada e nunca mascara o erro nem aborta a operação em curso. */
export async function recordInfraAudit(params: RecordInfraAuditParams): Promise<void> {
  try {
    await params.recordAudit.execute(params.entry)
  } catch {
    params.logger.error('Nao foi possivel gravar a auditoria de infra', { action: params.entry.action })
  }
}
