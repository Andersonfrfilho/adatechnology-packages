/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { randomUUID } from 'node:crypto'

import {
  INFRA_OPERATION_LOCK_GRACE_SECONDS,
  INFRA_OPERATION_LOCK_KEY_PREFIX,
} from '@adatechnology/railway-infra-contracts'
import type { InfraCacheInterface } from '@adatechnology/railway-infra-contracts'
import type { InfraLogger } from '@adatechnology/railway-infra-contracts'

export type InfraOperationLockDependencies = {
  readonly cache: InfraCacheInterface
  readonly logger: InfraLogger
  readonly databaseWaitSeconds: number
}

export type InfraOperationLockParams = {
  readonly environmentId: string
  readonly lockOwner: string
}

type LockAction = 'renew' | 'release'

/** Trava por ambiente no cache: so quem a criou (o `lockOwner`) a renova ou libera. */
export class InfraOperationLock {
  constructor(private readonly dependencies: InfraOperationLockDependencies) {}

  /** Devolve o dono da trava, ou `undefined` quando outra operacao ja a detem. */
  async acquire(environmentId: string): Promise<string | undefined> {
    const lockOwner = randomUUID()
    const isLockAcquired = await this.dependencies.cache.setIfAbsent({
      key: this.lockKey(environmentId),
      value: lockOwner,
      ttlSeconds: this.lockTtlSeconds(),
    })
    return isLockAcquired ? lockOwner : undefined
  }

  /** Renovar a trava e melhor esforco: falhar aqui nao pode reprovar um servico que ja foi ligado/desligado. */
  async renew(params: InfraOperationLockParams): Promise<void> {
    const { environmentId, lockOwner } = params
    try {
      const isOwner = await this.dependencies.cache.renewIfOwner({
        key: this.lockKey(environmentId),
        owner: lockOwner,
        ttlSeconds: this.lockTtlSeconds(),
      })
      if (!isOwner) this.logLockLost({ environmentId, action: 'renew' })
    } catch {
      this.dependencies.logger.error('Nao foi possivel renovar a trava da operacao de infra', { environmentId })
    }
  }

  async release(params: InfraOperationLockParams): Promise<void> {
    const { environmentId, lockOwner } = params
    try {
      const isOwner = await this.dependencies.cache.releaseIfOwner({
        key: this.lockKey(environmentId),
        owner: lockOwner,
      })
      if (!isOwner) this.logLockLost({ environmentId, action: 'release' })
    } catch {
      this.dependencies.logger.error('Nao foi possivel liberar a trava da operacao de infra', { environmentId })
    }
  }

  private lockKey(environmentId: string): string {
    return `${INFRA_OPERATION_LOCK_KEY_PREFIX}${environmentId}`
  }

  private lockTtlSeconds(): number {
    return this.dependencies.databaseWaitSeconds + INFRA_OPERATION_LOCK_GRACE_SECONDS
  }

  // A trava expirou (e talvez outra operacao a tenha): mexer nela derrubaria a protecao da outra.
  private logLockLost(params: { readonly environmentId: string; readonly action: LockAction }): void {
    this.dependencies.logger.info('Trava da operacao de infra nao pertence mais a esta operacao', params)
  }
}
