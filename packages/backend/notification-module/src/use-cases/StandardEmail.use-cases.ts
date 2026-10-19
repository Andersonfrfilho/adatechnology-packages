/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O modelo padrão de e-mail (`notification.standard-email`): cadastro, resolução, renderização e
 * restauração. O módulo não envia — quem transporta o e-mail é o host.
 */

import {
  STANDARD_EMAIL_BUILTIN_TEMPLATE,
  STANDARD_EMAIL_CHANNEL,
  STANDARD_EMAIL_LOCALE,
  STANDARD_EMAIL_TEMPLATE_KEY,
  assessStandardEmailTemplate,
  renderStandardEmail,
} from '@adatechnology/notification-contracts'
import type {
  LoggerPort,
  NotificationTemplate,
  RenderedStandardEmail,
  StandardEmailInput,
  StandardEmailTemplate,
} from '@adatechnology/notification-contracts'
import type { TemplateRepository } from '../repositories/TemplateRepository'
import { toNotificationTemplate } from './Template.use-cases'

/** Violação da unicidade `(empresa, chave, canal, locale, versão)` — outro processo gravou a v1 antes. */
function isUniqueViolation(error: unknown): boolean {
  const isUnique = (candidate: unknown): boolean => {
    const { code, errno } = (candidate ?? {}) as { code?: unknown; errno?: unknown }
    // No driver do Bun o SQLSTATE vem em `errno`; o `code` é `ERR_POSTGRES_SERVER_ERROR`.
    return code === '23505' || errno === '23505'
  }
  return isUnique(error) || isUnique((error as { cause?: unknown } | null)?.cause)
}

export class StandardEmailService {
  constructor(
    private readonly templates: TemplateRepository,
    private readonly logger?: LoggerPort,
  ) {}

  /**
   * Grava a v1 com o conteúdo embutido só se a identidade não tem NENHUMA linha (ativa ou não):
   * versão editada ou desativada pela empresa nunca é sobrescrita. Devolve `true` se criou.
   * Idempotente e seguro sob concorrência — perder a corrida pela v1 (23505) é "já existe".
   */
  async ensureTemplate(params: { companyId: string; locale?: string }): Promise<boolean> {
    const identity = this.identity(params)
    if (await this.templates.existsIdentity(identity)) return false

    try {
      await this.templates.upsert({ ...identity, body: STANDARD_EMAIL_BUILTIN_TEMPLATE.html, active: true })
      return true
    } catch (error) {
      if (isUniqueViolation(error)) return false
      throw error
    }
  }

  /**
   * A versão ativa e usável da empresa; senão o embutido (`version: 0`) — o envio nunca fica sem
   * modelo. O log do fallback leva o motivo e ids, nunca o HTML.
   */
  async resolveTemplate(params: { companyId: string; locale?: string }): Promise<StandardEmailTemplate> {
    const row = await this.templates.findActive(this.identity(params))
    if (!row) {
      this.logFallback('missing', params.companyId)
      return STANDARD_EMAIL_BUILTIN_TEMPLATE
    }
    if (!assessStandardEmailTemplate(row.body).usable) {
      this.logFallback('unusable', params.companyId, row.id, row.version)
      return STANDARD_EMAIL_BUILTIN_TEMPLATE
    }
    return { html: row.body, source: 'company', version: row.version }
  }

  async render(params: {
    companyId: string
    locale?: string
    input: StandardEmailInput
  }): Promise<RenderedStandardEmail> {
    const template = await this.resolveTemplate(params)
    return renderStandardEmail({ input: params.input, template })
  }

  /** Versão nova com o conteúdo embutido; o histórico das edições fica. */
  async restoreDefault(params: { companyId: string; locale?: string }): Promise<NotificationTemplate> {
    const row = await this.templates.upsert({
      ...this.identity(params),
      body: STANDARD_EMAIL_BUILTIN_TEMPLATE.html,
      active: true,
    })
    return toNotificationTemplate(row)
  }

  private identity(params: { companyId: string; locale?: string }) {
    return {
      companyId: params.companyId,
      key: STANDARD_EMAIL_TEMPLATE_KEY,
      channel: STANDARD_EMAIL_CHANNEL,
      locale: params.locale ?? STANDARD_EMAIL_LOCALE,
    }
  }

  private logFallback(reason: 'missing' | 'unusable', companyId: string, templateId?: string, version?: number): void {
    this.logger?.warn('standard_email_template_fallback', {
      reason,
      companyId,
      key: STANDARD_EMAIL_TEMPLATE_KEY,
      ...(templateId === undefined ? {} : { templateId, version }),
    })
  }
}
