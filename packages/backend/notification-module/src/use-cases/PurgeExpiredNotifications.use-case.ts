/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Cron sugerido: diário. Retenção existe porque `notifications.title`/`body`/`payload` carrega
 * conteúdo endereçado a uma pessoa — reter para sempre é o oposto de minimização de dados
 * (`security.md` §1, LGPD).
 */

export type PurgeExpiredNotificationsDependencies = {
  readonly notifications: { purgeExpired(params: { olderThan: Date }): Promise<number> }
  readonly clock?: { now(): Date }
}

const DEFAULT_RETENTION_DAYS = 180
const MS_PER_DAY = 24 * 60 * 60 * 1000

export class PurgeExpiredNotificationsUseCase {
  constructor(
    private readonly dependencies: PurgeExpiredNotificationsDependencies,
    private readonly config: { retentionDays?: number },
  ) {}

  async execute(): Promise<{ purged: number }> {
    const now = this.dependencies.clock?.now() ?? new Date()
    const retentionDays = this.config.retentionDays ?? DEFAULT_RETENTION_DAYS
    const olderThan = new Date(now.getTime() - retentionDays * MS_PER_DAY)

    const purged = await this.dependencies.notifications.purgeExpired({ olderThan })
    return { purged }
  }
}
