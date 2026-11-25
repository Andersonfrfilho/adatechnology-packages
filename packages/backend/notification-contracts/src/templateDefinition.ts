/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A definição de um template: o que o host declara no boot para que o painel saiba rotular,
 * explicar, validar e restaurar o texto. O conteúdo editável vive no banco (versionado); a definição
 * é código do host e nunca é gravada — por isso evoluir rótulo, descrição ou variáveis não exige
 * migration.
 *
 * Mora no contracts porque a tela lista as definições e o módulo as valida com a MESMA regra.
 */

import type { NotificationChannel, NotificationTemplate } from './notification.types'
import { diffTemplateVariables } from './templateVariables'
import type { TemplateVariableCatalog, TemplateVariableDefinition } from './templateVariables'

export type TemplateDefinitionIdentity = {
  readonly key: string
  readonly channel: NotificationChannel
  readonly locale: string
}

export type TemplateDefinition = TemplateDefinitionIdentity & {
  /** Nome legível mostrado na lista do painel. */
  readonly label: string
  readonly description?: string
  /** Variáveis que o payload promete, com descrição e exemplo. Alimenta validação e preview. */
  readonly variables: readonly TemplateVariableDefinition[]
  /** Texto padrão: gravado como v1 por `ensure` e reaplicado por "restaurar padrão". */
  readonly body: string
  readonly subject?: string
  readonly whatsappTemplateName?: string
}

/** Uma linha do painel: a definição do host + o estado gravado. Contrato de `GET /notification-template-definitions`. */
export type TemplateEditorItem = {
  readonly key: string
  readonly channel: NotificationChannel
  readonly locale: string
  readonly label: string
  readonly description?: string
  readonly variables: readonly TemplateVariableDefinition[]
  readonly defaultBody: string
  readonly defaultSubject?: string
  /** A versão ativa mais alta; ausente se nunca foi gravada ou foi desativada. */
  readonly current?: NotificationTemplate
  /** `true` quando o texto ativo difere do padrão — é o que habilita "restaurar padrão". */
  readonly isCustomized: boolean
}

export class InvalidTemplateDefinitionError extends Error {
  constructor(
    public readonly definitionKey: string,
    reason: string,
  ) {
    super(`Definição de template inválida (${definitionKey}): ${reason}`)
    this.name = 'InvalidTemplateDefinitionError'
  }
}

/** Catálogo por `key`. Locales diferentes da mesma chave compartilham as variáveis da primeira. */
export function buildTemplateVariableCatalog(definitions: readonly TemplateDefinition[]): TemplateVariableCatalog {
  const catalog: Record<string, readonly TemplateVariableDefinition[]> = {}
  for (const definition of definitions) {
    catalog[definition.key] ??= definition.variables
  }
  return catalog
}

export function findTemplateDefinition(
  definitions: readonly TemplateDefinition[],
  identity: TemplateDefinitionIdentity,
): TemplateDefinition | undefined {
  return definitions.find(
    (definition) =>
      definition.key === identity.key &&
      definition.channel === identity.channel &&
      definition.locale === identity.locale,
  )
}

/** Falha no boot, não no primeiro "restaurar": um padrão que o próprio `upsert` recusaria é bug do host. */
export function assertTemplateDefinitions(definitions: readonly TemplateDefinition[]): void {
  const seen = new Set<string>()
  for (const definition of definitions) {
    const identity = `${definition.key}|${definition.channel}|${definition.locale}`
    if (seen.has(identity)) throw new InvalidTemplateDefinitionError(definition.key, 'identidade duplicada')
    seen.add(identity)

    if (definition.label.trim() === '') throw new InvalidTemplateDefinitionError(definition.key, 'label vazio')
    if (definition.body.trim() === '') throw new InvalidTemplateDefinitionError(definition.key, 'body vazio')

    const names = definition.variables.map((variable) => variable.name)
    if (new Set(names).size !== names.length) {
      throw new InvalidTemplateDefinitionError(definition.key, 'variável declarada duas vezes')
    }

    const { unknown } = diffTemplateVariables({
      body: definition.body,
      subject: definition.subject,
      variables: definition.variables,
    })
    if (unknown.length > 0) {
      throw new InvalidTemplateDefinitionError(
        definition.key,
        `o texto padrão usa variáveis não declaradas: ${unknown.join(', ')}`,
      )
    }
  }
}
