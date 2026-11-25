/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Um turno do runner por conversa de cada vez. Duas mensagens do mesmo cliente processadas em
 * paralelo leriam a mesma posição, responderiam ao mesmo nó e a última gravação apagaria a outra.
 *
 * Porta, com implementação padrão no Postgres do próprio módulo; o host troca por outra (Redis,
 * fila particionada por conversa) quando quiser.
 */

import { sql } from 'drizzle-orm'
import type { MetaWhatsAppDatabase } from '../database.types'

export type FlowTurnLockKey = {
  readonly companyId: string
  readonly whatsappNumber: string
}

export interface FlowTurnLockInterface {
  withLock<TResult>(key: FlowTurnLockKey, work: () => Promise<TResult>): Promise<TResult>
}

function lockName(key: FlowTurnLockKey): string {
  return `meta_whatsapp_flow:${key.companyId}:${key.whatsappNumber}`
}

/**
 * `pg_advisory_xact_lock` numa transação que dura o turno. A transação não toca linha nenhuma —
 * só segura o lock (e uma conexão do pool) enquanto o turno roda; as escritas do turno usam a
 * conexão normal. O lock sai sozinho no fim da transação, inclusive se o processo morrer.
 *
 * Custo: uma conexão por conversa em atendimento simultâneo. Com muitas conversas ao mesmo tempo,
 * dimensione o pool ou injete outra implementação.
 */
export class PostgresAdvisoryFlowTurnLock implements FlowTurnLockInterface {
  constructor(private readonly db: MetaWhatsAppDatabase) {}

  withLock<TResult>(key: FlowTurnLockKey, work: () => Promise<TResult>): Promise<TResult> {
    return this.db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${lockName(key)}))`)
      return work()
    })
  }
}

/** Lock dentro do processo: serve para uma instância só e para testes. Não protege entre réplicas. */
export class InProcessFlowTurnLock implements FlowTurnLockInterface {
  private readonly tails = new Map<string, Promise<unknown>>()

  async withLock<TResult>(key: FlowTurnLockKey, work: () => Promise<TResult>): Promise<TResult> {
    const name = lockName(key)
    const previous = this.tails.get(name) ?? Promise.resolve()
    const current = previous.catch(() => undefined).then(work)
    this.tails.set(name, current)
    try {
      return await current
    } finally {
      if (this.tails.get(name) === current) this.tails.delete(name)
    }
  }
}
