/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O catálogo de variáveis de um template, e a diferença entre o que ele declara e o que o texto
 * usa.
 *
 * Existe porque `{{campo}}` desconhecido não falha: `interpolateTemplate` devolve string vazia, que
 * é o comportamento correto no envio — mensagem com buraco é melhor que mensagem com `{{campo}}`
 * cru. O preço é que um erro de digitação no painel some sem log e sem erro, e só aparece quando o
 * cliente recebe "Olá , seu pedido". Com um painel, isso deixa de ser raro.
 *
 * A função é pura e mora aqui, e não no módulo, pelo mesmo motivo do `renderTemplate`: a validação
 * do servidor e o aviso da tela precisam da MESMA regra, e o frontend não pode importar o módulo
 * (carrega Drizzle). Duas implementações divergiriam, e a tela passaria a aprovar o que a rota
 * recusa.
 */

import { extractTemplatePlaceholders } from './templateRender'

export type TemplateVariableDefinition = {
  readonly name: string
  /** Valor de exemplo — alimenta o preview. Só o produto sabe que `orderNumber` é "QC-1042". */
  readonly example: string
  /** `true` avisa quando o texto não usa a variável; nunca bloqueia (ver `diffTemplateVariables`). */
  readonly required: boolean
  /** Chave de i18n do rótulo na tela. Ausente, a tela mostra o próprio `name`. */
  readonly labelKey?: string
}

/** `templateKey` → variáveis que o produto promete enviar no payload daquela notificação. */
export type TemplateVariableCatalog = Readonly<Record<string, readonly TemplateVariableDefinition[]>>

export type TemplateVariableDiff = {
  /** Placeholders que o texto referencia, na ordem em que aparecem. */
  readonly used: readonly string[]
  /** Referenciados e não declarados — renderizariam vazio para sempre. */
  readonly unknown: readonly string[]
  /** Declarados como `required` e ausentes do texto. */
  readonly missingRequired: readonly string[]
}

export type DiffTemplateVariablesParams = {
  readonly body: string
  readonly subject?: string | undefined
  /**
   * Ausente significa catálogo não declarado para esta `key`, e não catálogo vazio: nesse caso
   * nada é desconhecido. Fechar por omissão quebraria todo host que já usa o módulo sem catálogo.
   */
  readonly variables?: readonly TemplateVariableDefinition[] | undefined
}

export function diffTemplateVariables(params: DiffTemplateVariablesParams): TemplateVariableDiff {
  const used = extractTemplatePlaceholders(`${params.subject ?? ''}\n${params.body}`)

  if (!params.variables) return { used, unknown: [], missingRequired: [] }

  const declared = new Set(params.variables.map((variable) => variable.name))
  const usedSet = new Set(used)

  return {
    used,
    unknown: used.filter((name) => !declared.has(name)),
    missingRequired: params.variables
      .filter((variable) => variable.required && !usedSet.has(variable.name))
      .map((variable) => variable.name),
  }
}

/**
 * O payload de preview sai do próprio catálogo. Um mapa `key → exemplo` mantido em paralelo
 * divergiria do catálogo na primeira variável nova, e o preview voltaria a mentir.
 */
export function buildPreviewPayload(
  variables: readonly TemplateVariableDefinition[] | undefined,
): Readonly<Record<string, string>> {
  if (!variables) return {}
  return Object.fromEntries(variables.map((variable) => [variable.name, variable.example]))
}
