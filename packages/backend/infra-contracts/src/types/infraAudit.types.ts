/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraAuditAction, InfraAuditActorType, InfraAuditTarget } from '../infraAudit.constant'

export type InfraAuditEntry = {
  readonly actorType: InfraAuditActorType
  readonly actorId?: string
  readonly action: InfraAuditAction
  readonly targetType: InfraAuditTarget
  /** Sempre UUID. Alvo sem UUID vai na metadata. */
  readonly targetId?: string
  readonly ipAddress?: string
  readonly metadata?: Readonly<Record<string, unknown>>
}

/** Porta da trilha de auditoria do host. */
export interface InfraAuditRecorderInterface {
  execute(entry: InfraAuditEntry): Promise<void>
}
