/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Funções puras do editor de templates declarados pelo host.
 */

import { buildPreviewPayload, renderTemplate } from '@adatechnology/notification-contracts'
import type { RenderedTemplatePreview, TemplateEditorItem } from '@adatechnology/notification-contracts'

import { insertAt } from './messageFormat.util'

export type TemplateEditorGroup = {
  readonly category: string
  readonly items: readonly TemplateEditorItem[]
}

export function templateEditorItemId(item: Pick<TemplateEditorItem, 'key' | 'channel' | 'locale'>): string {
  return `${item.key}|${item.channel}|${item.locale}`
}

/** `auth` em `auth.reset`; chave sem ponto é a própria categoria. */
function categoryOf(key: string): string {
  return key.split('.')[0] ?? key
}

/** Agrupa pela categoria da chave; grupos e itens ficam na ordem em que o host os declarou. */
export function groupTemplateEditorItems(items: readonly TemplateEditorItem[]): TemplateEditorGroup[] {
  const groups = new Map<string, TemplateEditorItem[]>()
  for (const item of items) {
    const category = categoryOf(item.key)
    groups.set(category, [...(groups.get(category) ?? []), item])
  }
  return [...groups.entries()].map(([category, grouped]) => ({ category, items: grouped }))
}

/** O texto em edição: rascunho, senão a versão ativa, senão o padrão declarado. */
export function resolveEditorBody(item: TemplateEditorItem, draftBody: string | undefined): string {
  return draftBody ?? item.current?.body ?? item.defaultBody
}

export function insertVariable(params: {
  readonly body: string
  readonly variableName: string
  readonly selectionStart: number
  readonly selectionEnd: number
}): { readonly text: string; readonly cursor: number } {
  const result = insertAt({
    text: params.body,
    insertion: `{{${params.variableName}}}`,
    selectionStart: params.selectionStart,
    selectionEnd: params.selectionEnd,
  })
  return { text: result.text, cursor: result.selectionStart }
}

/** Mesmo `renderTemplate` do envio, alimentado pelos exemplos que o host declarou. */
export function renderDefinitionPreview(item: TemplateEditorItem, body: string): RenderedTemplatePreview {
  return renderTemplate({
    channel: item.channel,
    subject: item.current?.subject ?? item.defaultSubject,
    body,
    payload: buildPreviewPayload(item.variables),
  })
}

export function isDraftDirty(item: TemplateEditorItem, draftBody: string | undefined): boolean {
  return draftBody !== undefined && draftBody !== (item.current?.body ?? item.defaultBody)
}
