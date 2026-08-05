/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A lógica do editor de template, que estava reimplementada no host.
 *
 * Ela veio de `quickcart/modules/notifications/hooks/useNotificationSettings.hook.ts` — 207 linhas
 * que o segundo produto reescreveria, com as mesmas quatro decisões sutis para redescobrir. Elas
 * são o motivo de isto ser pacote e não exemplo:
 *
 * 1. **Versão ativa mais alta.** A rota devolve o histórico inteiro, correto para auditoria; na tela
 *    isso faz a mesma mensagem aparecer três vezes e ninguém sabe qual está no ar.
 * 2. **Seleção pelo id, não pelo objeto.** Salvar cria versão nova no servidor; segurando o objeto,
 *    o editor mostra a versão que já não é a ativa e a gravação seguinte parte de um texto velho.
 * 3. **Campo vazio é ausência.** Gravar `subject: ''` faz o renderer tratar como subject existente e
 *    derivar título vazio, em vez de cair no fallback que usa o corpo.
 * 4. **Preview pelo `renderTemplate` do contracts**, o mesmo do envio. Reimplementar a interpolação
 *    dá um preview que confere hoje e mente quando o renderer mudar.
 */

import { useMemo, useState } from 'react'
import { renderTemplate } from '@adatechnology/notification-contracts'
import type {
  NotificationTemplate,
  RenderedTemplatePreview,
  UpsertTemplateBody,
} from '@adatechnology/notification-contracts'

import { useTemplates, useUpsertTemplate } from './usePreferences'

export type TemplateDraft = {
  readonly key: string
  readonly channel: string
  readonly locale: string
  readonly subject: string
  readonly body: string
  readonly whatsappTemplateName: string
}

function toDraft(template: NotificationTemplate): TemplateDraft {
  return {
    key: template.key,
    channel: template.channel,
    locale: template.locale,
    subject: template.subject ?? '',
    body: template.body,
    whatsappTemplateName: template.whatsappTemplateName ?? '',
  }
}

export type UseTemplateEditorParams = {
  /**
   * Valores de exemplo do preview. É do produto: só ele sabe que `{{shortCode}}` é "QC-1042".
   * Ausente, o preview mostra os campos vazios — que é o que o destinatário veria mesmo.
   */
  readonly previewPayload?: Readonly<Record<string, unknown>>
}

export type UseTemplateEditorResult = {
  readonly templates: readonly NotificationTemplate[]
  readonly isLoading: boolean
  readonly isSaving: boolean
  readonly error: string | undefined
  readonly selected: NotificationTemplate | undefined
  readonly draft: TemplateDraft | undefined
  readonly preview: RenderedTemplatePreview | undefined
  readonly isDirty: boolean
  select: (template: NotificationTemplate) => void
  update: (patch: Partial<TemplateDraft>) => void
  save: () => void
  clear: () => void
}

export function useTemplateEditor(params: UseTemplateEditorParams = {}): UseTemplateEditorResult {
  const templatesQuery = useTemplates()
  const upsert = useUpsertTemplate()

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [draft, setDraft] = useState<TemplateDraft | undefined>(undefined)

  /** Decisão 1: só a ativa mais alta por `key`+`channel`+`locale` — a mesma que o envio faz. */
  const templates = useMemo(() => {
    const activeByIdentity = new Map<string, NotificationTemplate>()
    for (const template of templatesQuery.data ?? []) {
      if (!template.active) continue
      const identity = `${template.key}:${template.channel}:${template.locale}`
      const current = activeByIdentity.get(identity)
      if (!current || template.version > current.version) activeByIdentity.set(identity, template)
    }
    return [...activeByIdentity.values()].sort(
      (left, right) => left.key.localeCompare(right.key) || left.channel.localeCompare(right.channel),
    )
  }, [templatesQuery.data])

  /** Decisão 2: derivado do id. */
  const selected = useMemo(() => templates.find((template) => template.id === selectedId), [templates, selectedId])

  /** Decisão 4: o mesmo render do envio. */
  const preview = useMemo(() => {
    if (!draft) return undefined
    return renderTemplate({
      channel: draft.channel,
      subject: draft.subject || undefined,
      body: draft.body,
      payload: params.previewPayload ?? {},
    })
  }, [draft, params.previewPayload])

  const isDirty = useMemo(() => {
    if (!draft || !selected) return false
    const original = toDraft(selected)
    return (Object.keys(original) as (keyof TemplateDraft)[]).some((field) => original[field] !== draft[field])
  }, [draft, selected])

  return {
    templates,
    isLoading: templatesQuery.isLoading,
    isSaving: upsert.isPending,
    error: upsert.error?.message,
    selected,
    draft,
    preview,
    isDirty,

    select(template) {
      setSelectedId(template.id)
      setDraft(toDraft(template))
    },

    update(patch) {
      setDraft((current) => (current ? { ...current, ...patch } : current))
    },

    save() {
      if (!draft) return
      const body: UpsertTemplateBody = {
        key: draft.key,
        channel: draft.channel as UpsertTemplateBody['channel'],
        locale: draft.locale,
        active: true,
        body: draft.body,
        // Decisão 3: chave omitida quando vazia.
        ...(draft.subject ? { subject: draft.subject } : {}),
        ...(draft.whatsappTemplateName ? { whatsappTemplateName: draft.whatsappTemplateName } : {}),
      }
      // A versão nova tem outro id: soltar a seleção evita o editor ficar preso na anterior.
      upsert.mutate(body, { onSuccess: () => setSelectedId(undefined) })
    },

    clear() {
      setSelectedId(undefined)
      setDraft(undefined)
    },
  }
}
