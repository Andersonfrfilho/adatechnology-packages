/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { NotificationChannel, NotificationTemplate } from '@adatechnology/notification-contracts'
import type { TemplateRepository, UpsertTemplateInput } from '../repositories/TemplateRepository'
import type { TemplateRow } from '../schema/schema'

function toNotificationTemplate(row: TemplateRow): NotificationTemplate {
  return {
    id: row.id,
    key: row.key,
    channel: row.channel as NotificationChannel,
    locale: row.locale,
    version: row.version,
    subject: row.subject ?? undefined,
    body: row.body,
    whatsappTemplateName: row.whatsappTemplateName ?? undefined,
    active: row.active,
  }
}

export class UpsertTemplateUseCase {
  constructor(private readonly templates: TemplateRepository) {}

  async execute(params: { companyId: string } & UpsertTemplateInput): Promise<NotificationTemplate> {
    const row = await this.templates.upsert(params)
    return toNotificationTemplate(row)
  }
}

export class ListTemplatesUseCase {
  constructor(private readonly templates: TemplateRepository) {}

  async execute(params: { companyId: string }): Promise<NotificationTemplate[]> {
    const rows = await this.templates.listByCompany(params)
    return rows.map(toNotificationTemplate)
  }
}

/**
 * Não inventa conteúdo — o texto do template é regra de negócio do produto (§2 da regra de
 * módulos plugáveis). Isto só roda `upsert` em lote pelos use-cases do módulo, nunca `INSERT`
 * bruto (`code-standart.md` §5), para o host popular os templates default dele no boot/seed.
 */
export class SeedDefaultTemplatesUseCase {
  constructor(private readonly upsertTemplate: UpsertTemplateUseCase) {}

  async execute(params: {
    companyId: string
    templates: readonly UpsertTemplateInput[]
  }): Promise<NotificationTemplate[]> {
    const created: NotificationTemplate[] = []
    for (const template of params.templates) {
      // previsível é preferível a paralelizar escritas de versão (upsert incrementa a versão
      // lendo a anterior; em paralelo, duas chamadas para a MESMA chave poderiam ler o mesmo
      // "atual" e colidir na versão seguinte).
      created.push(await this.upsertTemplate.execute({ companyId: params.companyId, ...template }))
    }
    return created
  }
}
