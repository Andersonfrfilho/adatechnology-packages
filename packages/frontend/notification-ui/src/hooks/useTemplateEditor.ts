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
 *
 * A criação de template novo trouxe uma quinta: **a identidade é imutável depois de criada**.
 * `key`+`channel`+`locale` é o que o `sendNotification` procura; deixar editar num template
 * existente não seria edição, seria criar outro e deixar o antigo órfão no ar.
 */

import { useMemo, useState } from 'react'
import {
  PREVIEW_VIEWPORT_BY_CHANNEL,
  buildPreviewPayload,
  diffTemplateVariables,
  renderTemplate,
} from '@adatechnology/notification-contracts'
import type {
  NotificationChannel,
  NotificationTemplate,
  PreviewViewportSpec,
  RenderedTemplatePreview,
  TemplateVariableDefinition,
  TemplateVariableDiff,
  UpsertTemplateBody,
} from '@adatechnology/notification-contracts'

import { useDeactivateTemplate, useTemplateVariables, useTemplates, useUpsertTemplate } from './usePreferences'

export type TemplateDraft = {
  readonly key: string
  readonly channel: string
  readonly locale: string
  readonly subject: string
  readonly body: string
  readonly whatsappTemplateName: string
}

export type TemplateDraftField = 'subject' | 'body'

export type TemplatePreviewFrame = PreviewViewportSpec & {
  readonly rendered: RenderedTemplatePreview
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

function buildEmptyDraft(params: { channel: string; locale: string }): TemplateDraft {
  return { key: '', channel: params.channel, locale: params.locale, subject: '', body: '', whatsappTemplateName: '' }
}

export type UseTemplateEditorParams = {
  /**
   * Valores de exemplo do preview. Hoje o padrão vem do catálogo de variáveis do servidor; isto
   * continua existindo para o produto sobrescrever um exemplo pontual sem mexer no catálogo.
   */
  readonly previewPayload?: Readonly<Record<string, unknown>>
  /** Canal e locale de um template novo, antes de o operador escolher. */
  readonly defaultChannel?: string
  readonly defaultLocale?: string
}

export type UseTemplateEditorResult = {
  readonly templates: readonly NotificationTemplate[]
  readonly isLoading: boolean
  readonly isSaving: boolean
  readonly isDeactivating: boolean
  readonly error: string | undefined
  readonly selected: NotificationTemplate | undefined
  readonly draft: TemplateDraft | undefined
  /** `true` enquanto o rascunho é um template que ainda não existe no servidor. */
  readonly isNew: boolean
  /** Identidade travada — `false` só durante a criação. */
  readonly isIdentityLocked: boolean
  /** Os dois quadros do preview, na ordem em que a tela desenha. */
  readonly previews: readonly TemplatePreviewFrame[]
  /** As variáveis que esta `key` declara. Vazio quando o catálogo não conhece a chave. */
  readonly variables: readonly TemplateVariableDefinition[]
  readonly variableDiff: TemplateVariableDiff
  readonly isDirty: boolean
  readonly canSave: boolean
  select: (template: NotificationTemplate) => void
  startNew: () => void
  update: (patch: Partial<TemplateDraft>) => void
  /** Insere `{{nome}}` na posição do cursor. O operador nunca digita o nome à mão. */
  insertVariable: (params: { name: string; field: TemplateDraftField; cursorIndex: number }) => void
  save: () => void
  deactivate: (id: string) => void
  clear: () => void
}

export function useTemplateEditor(params: UseTemplateEditorParams = {}): UseTemplateEditorResult {
  const templatesQuery = useTemplates()
  const variablesQuery = useTemplateVariables()
  const upsert = useUpsertTemplate()
  const deactivateMutation = useDeactivateTemplate()

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [draft, setDraft] = useState<TemplateDraft | undefined>(undefined)
  const [isNew, setIsNew] = useState(false)

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

  const variables = useMemo(() => (draft ? (variablesQuery.data?.[draft.key] ?? []) : []), [variablesQuery.data, draft])

  const variableDiff = useMemo(
    () =>
      diffTemplateVariables({
        body: draft?.body ?? '',
        subject: draft?.subject || undefined,
        // Chave sem entrada no catálogo é catálogo não declarado, não catálogo vazio — o servidor
        // aceita qualquer variável nesse caso, e a tela não pode acusar o que a rota vai gravar.
        variables: draft && variablesQuery.data?.[draft.key] ? variables : undefined,
      }),
    [draft, variables, variablesQuery.data],
  )

  /** Decisão 4: o mesmo render do envio, uma vez por viewport do canal. */
  const previews = useMemo<readonly TemplatePreviewFrame[]>(() => {
    if (!draft) return []
    const payload = { ...buildPreviewPayload(variables), ...(params.previewPayload ?? {}) }
    const rendered = renderTemplate({
      channel: draft.channel,
      subject: draft.subject || undefined,
      body: draft.body,
      payload,
    })
    const viewports = PREVIEW_VIEWPORT_BY_CHANNEL[draft.channel as NotificationChannel] ?? []
    return viewports.map((viewport) => ({ ...viewport, rendered }))
  }, [draft, variables, params.previewPayload])

  const isDirty = useMemo(() => {
    if (!draft) return false
    if (isNew) return draft.key.length > 0 || draft.body.length > 0
    if (!selected) return false
    const original = toDraft(selected)
    return (Object.keys(original) as (keyof TemplateDraft)[]).some((field) => original[field] !== draft[field])
  }, [draft, selected, isNew])

  return {
    templates,
    isLoading: templatesQuery.isLoading,
    isSaving: upsert.isPending,
    isDeactivating: deactivateMutation.isPending,
    error: upsert.error?.message ?? deactivateMutation.error?.message,
    selected,
    draft,
    isNew,
    isIdentityLocked: !isNew,
    previews,
    variables,
    variableDiff,
    isDirty,
    // A variável desconhecida é recusada pelo servidor com 400; bloquear o botão evita a ida
    // perdida, sem virar a única defesa — a validação continua sendo a da rota.
    canSave: Boolean(draft?.key && draft.body) && variableDiff.unknown.length === 0,

    select(template) {
      setSelectedId(template.id)
      setDraft(toDraft(template))
      setIsNew(false)
    },

    startNew() {
      setSelectedId(undefined)
      setIsNew(true)
      setDraft(buildEmptyDraft({ channel: params.defaultChannel ?? 'email', locale: params.defaultLocale ?? 'pt-BR' }))
    },

    update(patch) {
      setDraft((current) => (current ? { ...current, ...patch } : current))
    },

    insertVariable({ name, field, cursorIndex }) {
      setDraft((current) => {
        if (!current) return current
        const text = current[field]
        const at = Math.min(Math.max(cursorIndex, 0), text.length)
        return { ...current, [field]: `${text.slice(0, at)}{{${name}}}${text.slice(at)}` }
      })
    },

    save() {
      if (!draft) return
      const body: UpsertTemplateBody = {
        key: draft.key,
        channel: draft.channel as UpsertTemplateBody['channel'],
        locale: draft.locale,
        active: true,
        body: draft.body,
        ...(draft.subject ? { subject: draft.subject } : {}),
        ...(draft.whatsappTemplateName ? { whatsappTemplateName: draft.whatsappTemplateName } : {}),
      }
      upsert.mutate(body, {
        onSuccess: () => {
          setSelectedId(undefined)
          setDraft(undefined)
          setIsNew(false)
        },
      })
    },

    deactivate(id) {
      deactivateMutation.mutate(id, {
        onSuccess: () => {
          if (selectedId !== id) return
          setSelectedId(undefined)
          setDraft(undefined)
        },
      })
    },

    clear() {
      setSelectedId(undefined)
      setDraft(undefined)
      setIsNew(false)
    },
  }
}
