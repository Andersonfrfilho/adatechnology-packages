/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Os templates que o host declara por `config.templateDefinitions`: garantir o padrão no banco,
 * listar para o painel, restaurar o padrão e renderizar um texto por chave. O conteúdo editado
 * continua sendo versão imutável em `templates`; a definição (rótulo, variáveis, texto padrão) é só
 * código do host.
 */

import {
  TemplateIdNotFoundError,
  TemplateNotFoundError,
  findTemplateDefinition,
} from '@adatechnology/notification-contracts'
import type {
  NotificationChannel,
  NotificationTemplate,
  RenderedTemplate,
  TemplateDefinition,
  TemplateEditorItem,
  TemplateRendererPort,
} from '@adatechnology/notification-contracts'
import type { TemplateRepository } from '../repositories/TemplateRepository'
import type { TemplateRow } from '../schema/schema'
import { isUniqueViolation } from './StandardEmail.use-cases'
import { toNotificationTemplate } from './Template.use-cases'

/**
 * Grava a v1 de cada definição **só se a identidade não tem nenhuma linha** (ativa ou não): texto
 * editado ou desativado pela empresa nunca é sobrescrito. Idempotente e seguro sob concorrência —
 * perder a corrida pela v1 (23505) é "já existe". Roda no boot/pré-deploy, por empresa.
 */
export class EnsureTemplateDefinitionsUseCase {
  constructor(
    private readonly templates: TemplateRepository,
    private readonly definitions: readonly TemplateDefinition[],
  ) {}

  /** Devolve as chaves criadas nesta chamada. */
  async execute(params: { companyId: string }): Promise<string[]> {
    const created: string[] = []
    for (const definition of this.definitions) {
      if (await this.ensureOne(params.companyId, definition)) created.push(definition.key)
    }
    return created
  }

  private async ensureOne(companyId: string, definition: TemplateDefinition): Promise<boolean> {
    const identity = { companyId, key: definition.key, channel: definition.channel, locale: definition.locale }
    if (await this.templates.existsIdentity(identity)) return false
    try {
      await this.templates.insertVersion({
        ...identity,
        version: 1,
        subject: definition.subject,
        body: definition.body,
        whatsappTemplateName: definition.whatsappTemplateName,
        active: true,
      })
      return true
    } catch (error) {
      if (isUniqueViolation(error)) return false
      throw error
    }
  }
}

export class ListTemplateEditorItemsUseCase {
  constructor(
    private readonly templates: TemplateRepository,
    private readonly definitions: readonly TemplateDefinition[],
  ) {}

  async execute(params: { companyId: string }): Promise<TemplateEditorItem[]> {
    const rows = await this.templates.listByCompany(params)
    return this.definitions.map((definition) => {
      const row = latestActive(rows, definition)
      return {
        key: definition.key,
        channel: definition.channel,
        locale: definition.locale,
        label: definition.label,
        ...(definition.description === undefined ? {} : { description: definition.description }),
        variables: definition.variables,
        defaultBody: definition.body,
        ...(definition.subject === undefined ? {} : { defaultSubject: definition.subject }),
        ...(row === undefined ? {} : { current: toNotificationTemplate(row) }),
        isCustomized:
          row !== undefined && (row.body !== definition.body || (row.subject ?? undefined) !== definition.subject),
      }
    })
  }
}

function latestActive(rows: readonly TemplateRow[], identity: TemplateDefinition): TemplateRow | undefined {
  return rows
    .filter(
      (row) =>
        row.active && row.key === identity.key && row.channel === identity.channel && row.locale === identity.locale,
    )
    .sort((left, right) => right.version - left.version)[0]
}

/** Versão nova com o texto padrão da definição; o histórico das edições fica. */
export class RestoreTemplateDefaultUseCase {
  constructor(
    private readonly templates: TemplateRepository,
    private readonly definitions: readonly TemplateDefinition[],
  ) {}

  /** Id sem definição declarada é "não encontrado": só o que o host declarou tem padrão a restaurar. */
  async execute(params: { companyId: string; id: string }): Promise<NotificationTemplate> {
    const row = await this.templates.findById(params)
    const definition =
      row &&
      findTemplateDefinition(this.definitions, {
        key: row.key,
        channel: row.channel as NotificationChannel,
        locale: row.locale,
      })
    if (!row || !definition) throw new TemplateIdNotFoundError(params.id)

    const restored = await this.templates.upsert({
      companyId: params.companyId,
      key: definition.key,
      channel: definition.channel,
      locale: definition.locale,
      subject: definition.subject,
      body: definition.body,
      whatsappTemplateName: definition.whatsappTemplateName,
      active: true,
    })
    return toNotificationTemplate(restored)
  }
}

export type RenderedTemplateText = RenderedTemplate & {
  /** `company` = versão gravada; `default` = texto da definição (nada ativo no banco). */
  readonly source: 'company' | 'default'
  readonly version: number
}

/**
 * O texto pronto de uma chave, sem envio: para o host que transporta a mensagem por conta própria
 * (bot, resposta síncrona). Sem versão ativa cai no padrão declarado — nunca fica sem texto.
 */
export class RenderTemplateTextUseCase {
  constructor(
    private readonly templates: TemplateRepository,
    private readonly definitions: readonly TemplateDefinition[],
    private readonly renderer: TemplateRendererPort,
    private readonly defaultLocale: string,
  ) {}

  async execute(params: {
    companyId: string
    key: string
    channel: NotificationChannel
    locale?: string
    payload?: Readonly<Record<string, unknown>>
  }): Promise<RenderedTemplateText> {
    const identity = { key: params.key, channel: params.channel, locale: params.locale ?? this.defaultLocale }
    const row = await this.templates.findActive({ companyId: params.companyId, ...identity })
    const definition = findTemplateDefinition(this.definitions, identity)
    if (!row && !definition) throw new TemplateNotFoundError(identity.key, identity.channel, identity.locale)

    const body = row?.body ?? definition?.body ?? ''
    const subject = row ? (row.subject ?? undefined) : definition?.subject
    const rendered = await this.renderer.render({
      channel: identity.channel,
      locale: identity.locale,
      body,
      ...(subject === undefined ? {} : { subject }),
      payload: params.payload ?? {},
    })
    return { ...rendered, source: row ? 'company' : 'default', version: row?.version ?? 0 }
  }
}
