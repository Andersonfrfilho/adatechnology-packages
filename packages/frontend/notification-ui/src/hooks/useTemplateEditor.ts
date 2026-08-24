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
  /**
   * Canais, no plural: um aviso costuma sair por mais de um.
   *
   * No banco a identidade continua sendo `key`+`channel`+`locale` — uma linha por canal. Escolher
   * varios aqui grava um template por canal com o MESMO texto, que e o comportamento certo para
   * criar: escrever a mensagem uma vez e mandar por onde precisar. Depois, cada canal e editado
   * sozinho pela lista, porque o texto tende a divergir (o SMS encurta, o WhatsApp perde o titulo).
   */
  readonly channels: readonly string[]
  readonly locale: string
  /**
   * Texto POR CANAL, e não um só copiado para todos.
   *
   * Os canais não são o mesmo recado em molduras diferentes: o WhatsApp ignora o assunto, o SMS
   * cobra por segmento de 160 e encurta, o push corta em duas linhas. Um texto único obrigaria a
   * escrever para o pior canal e mandar isso a todos. No banco cada canal já é uma linha própria
   * (`key`+`channel`+`locale`) — aqui a tela passa a refletir isso.
   */
  readonly byChannel: Readonly<Record<string, ChannelDraft>>
}

export type ChannelDraft = {
  readonly subject: string
  readonly body: string
  readonly whatsappTemplateName: string
}

const EMPTY_CHANNEL: ChannelDraft = { subject: '', body: '', whatsappTemplateName: '' }

export type TemplateDraftField = 'subject' | 'body'

export type TemplatePreviewFrame = PreviewViewportSpec & {
  /** O canal viaja com o quadro: a moldura do preview depende dele, e ler do rascunho dentro do
   *  `map` perde a garantia de que o rascunho existe. */
  readonly channel: string
  readonly rendered: RenderedTemplatePreview
}

function toDraft(template: NotificationTemplate): TemplateDraft {
  return {
    key: template.key,
    channels: [template.channel],
    locale: template.locale,
    byChannel: {
      [template.channel]: {
        subject: template.subject ?? '',
        body: template.body,
        whatsappTemplateName: template.whatsappTemplateName ?? '',
      },
    },
  }
}

/** `auth` em `auth.password_reset`. Chave sem ponto é a própria categoria. */
function categoryOf(key: string): string {
  return key.split('.')[0] ?? key
}

function buildEmptyDraft(params: { channel: string; locale: string }): TemplateDraft {
  return {
    key: '',
    channels: [params.channel],
    locale: params.locale,
    byChannel: { [params.channel]: EMPTY_CHANNEL },
  }
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

/**
 * Um grupo da lista.
 *
 * O prefixo da chave (`auth` em `auth.password_reset`) já é a categoria que o produto escreveu — o
 * módulo não precisa de um campo novo no banco para agrupar, e um campo novo divergiria da chave
 * na primeira vez que alguém renomeasse um sem o outro.
 */
export type TemplateGroup = {
  readonly category: string
  readonly templates: readonly NotificationTemplate[]
}

export type UseTemplateEditorResult = {
  readonly templates: readonly NotificationTemplate[]
  /** Já filtrados e agrupados por categoria, na ordem em que a tela desenha. */
  readonly groups: readonly TemplateGroup[]
  /** Todas as categorias existentes, inclusive as que o filtro escondeu. */
  readonly categories: readonly string[]
  readonly search: string
  readonly channelFilter: readonly string[]
  readonly categoryFilter: readonly string[]
  readonly hasFilters: boolean
  /** Quantos templates existem antes de filtrar — separa "nada cadastrado" de "nada encontrado". */
  readonly totalCount: number
  setSearch: (value: string) => void
  toggleChannelFilter: (channel: string) => void
  toggleCategoryFilter: (category: string) => void
  clearFilters: () => void
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
  /** Edita o texto de UM canal. */
  updateChannel: (channel: string, patch: Partial<ChannelDraft>) => void
  /** Liga ou desliga um canal do rascunho. Nunca esvazia para nada: sem canal nao ha o que gravar. */
  toggleChannel: (channel: string) => void
  /** Insere `{{nome}}` na posição do cursor. O operador nunca digita o nome à mão. */
  insertVariable: (params: {
    name: string
    field: TemplateDraftField
    cursorIndex: number
    channel: string
  }) => void
  save: () => void
  deactivate: (id: string) => void
  clear: () => void
}

export function useTemplateEditor(params: UseTemplateEditorParams = {}): UseTemplateEditorResult {
  const templatesQuery = useTemplates()
  const variablesQuery = useTemplateVariables()
  const upsert = useUpsertTemplate()
  const deactivateMutation = useDeactivateTemplate()

  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState<readonly string[]>([])
  const [categoryFilter, setCategoryFilter] = useState<readonly string[]>([])
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

  const categories = useMemo(
    () => [...new Set(templates.map((template) => categoryOf(template.key)))].sort(),
    [templates],
  )

  /**
   * Busca sobre chave E texto: quem procura "senha" costuma lembrar do que a mensagem diz, não da
   * chave técnica que alguém escolheu meses atrás.
   */
  const filtered = useMemo(() => {
    const termo = search.trim().toLowerCase()

    return templates.filter((template) => {
      if (channelFilter.length > 0 && !channelFilter.includes(template.channel)) return false
      if (categoryFilter.length > 0 && !categoryFilter.includes(categoryOf(template.key))) return false
      if (!termo) return true
      return `${template.key} ${template.subject ?? ''} ${template.body}`.toLowerCase().includes(termo)
    })
  }, [templates, search, channelFilter, categoryFilter])

  const groups = useMemo<readonly TemplateGroup[]>(() => {
    const porCategoria = new Map<string, NotificationTemplate[]>()
    for (const template of filtered) {
      const categoria = categoryOf(template.key)
      const atual = porCategoria.get(categoria)
      if (atual) atual.push(template)
      else porCategoria.set(categoria, [template])
    }
    return [...porCategoria.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([category, list]) => ({ category, templates: list }))
  }, [filtered])

  /** Decisão 2: derivado do id. */
  const selected = useMemo(() => templates.find((template) => template.id === selectedId), [templates, selectedId])

  const variables = useMemo(() => (draft ? (variablesQuery.data?.[draft.key] ?? []) : []), [variablesQuery.data, draft])

  const variableDiff = useMemo(
    () =>
      diffTemplateVariables({
        /** Junta o texto de todos os canais: variavel errada em qualquer um recusa a gravacao. */
        body: draft ? draft.channels.map((c) => draft.byChannel[c]?.body ?? '').join('\n') : '',
        subject: draft ? draft.channels.map((c) => draft.byChannel[c]?.subject ?? '').join('\n') : undefined,
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
    /** Um conjunto de quadros por canal escolhido: e o que permite comparar como o mesmo texto
     *  chega no e-mail e no WhatsApp sem salvar antes. */
    return draft.channels.flatMap((channel) => {
      const content = draft.byChannel[channel] ?? EMPTY_CHANNEL
      const rendered = renderTemplate({
        channel,
        subject: content.subject || undefined,
        body: content.body,
        payload,
      })
      const viewports = PREVIEW_VIEWPORT_BY_CHANNEL[channel as NotificationChannel] ?? []
      return viewports.map((viewport) => ({ ...viewport, channel, rendered }))
    })
  }, [draft, variables, params.previewPayload])

  const isDirty = useMemo(() => {
    if (!draft) return false
    const temTexto = draft.channels.some((channel) => (draft.byChannel[channel]?.body ?? '').length > 0)
    if (isNew) return draft.key.length > 0 || temTexto
    if (!selected) return false
    const original = toDraft(selected).byChannel[selected.channel] ?? EMPTY_CHANNEL
    const atual = draft.byChannel[selected.channel] ?? EMPTY_CHANNEL
    return (Object.keys(original) as (keyof ChannelDraft)[]).some((field) => original[field] !== atual[field])
  }, [draft, selected, isNew])

  return {
    templates: filtered,
    groups,
    categories,
    search,
    channelFilter,
    categoryFilter,
    hasFilters: search.trim().length > 0 || channelFilter.length > 0 || categoryFilter.length > 0,
    totalCount: templates.length,
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
    /** Todo canal marcado precisa do proprio texto — senao a gravacao criaria template vazio. */
    canSave:
      Boolean(draft?.key) &&
      (draft?.channels.length ?? 0) > 0 &&
      (draft?.channels.every((channel) => (draft.byChannel[channel]?.body ?? '').length > 0) ?? false) &&
      variableDiff.unknown.length === 0,

    setSearch,

    toggleChannelFilter(channel) {
      setChannelFilter((current) =>
        current.includes(channel) ? current.filter((each) => each !== channel) : [...current, channel],
      )
    },

    toggleCategoryFilter(category) {
      setCategoryFilter((current) =>
        current.includes(category) ? current.filter((each) => each !== category) : [...current, category],
      )
    },

    clearFilters() {
      setSearch('')
      setChannelFilter([])
      setCategoryFilter([])
    },

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

    updateChannel(channel, patch) {
      setDraft((current) => {
        if (!current) return current
        const atual = current.byChannel[channel] ?? EMPTY_CHANNEL
        return { ...current, byChannel: { ...current.byChannel, [channel]: { ...atual, ...patch } } }
      })
    },

    toggleChannel(channel) {
      setDraft((current) => {
        if (!current) return current
        if (current.channels.includes(channel)) {
          /** O texto do canal desmarcado fica guardado: remarcar nao pode apagar o que foi escrito. */
          return { ...current, channels: current.channels.filter((each) => each !== channel) }
        }
        return {
          ...current,
          channels: [...current.channels, channel],
          byChannel: { ...current.byChannel, [channel]: current.byChannel[channel] ?? EMPTY_CHANNEL },
        }
      })
    },

    insertVariable({ name, field, cursorIndex, channel }) {
      setDraft((current) => {
        if (!current) return current
        const atual = current.byChannel[channel] ?? EMPTY_CHANNEL
        const text = atual[field]
        const at = Math.min(Math.max(cursorIndex, 0), text.length)
        return {
          ...current,
          byChannel: {
            ...current.byChannel,
            [channel]: { ...atual, [field]: `${text.slice(0, at)}{{${name}}}${text.slice(at)}` },
          },
        }
      })
    },

    save() {
      if (!draft) return

      /** Um `upsert` por canal, em serie: o servidor versiona por identidade, e o numero da versao
       *  de um canal nao pode depender da ordem de chegada do outro. */
      const bodies: UpsertTemplateBody[] = draft.channels.map((channel) => {
        const content = draft.byChannel[channel] ?? EMPTY_CHANNEL
        return {
          key: draft.key,
          channel: channel as UpsertTemplateBody['channel'],
          locale: draft.locale,
          active: true,
          body: content.body,
          ...(content.subject ? { subject: content.subject } : {}),
          ...(content.whatsappTemplateName ? { whatsappTemplateName: content.whatsappTemplateName } : {}),
        }
      })

      void bodies
        .reduce(
          (queue, body) => queue.then(() => upsert.mutateAsync(body).then(() => undefined)),
          Promise.resolve<void>(undefined),
        )
        .then(() => {
          setSelectedId(undefined)
          setDraft(undefined)
          setIsNew(false)
        })
        .catch(() => undefined)
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
