/**
 * Tela completa de "Mensagens": mensagens do bot, tópicos, templates do WhatsApp e transcrição.
 *
 * Os formulários daqui já eram do pacote, mas cada produto remontava as abas, o estado e o
 * salvamento por conta — e foi exatamente aí que divergiram (o financiamento tinha tópicos e
 * criação de template, o QuickCart tinha transcrição, e nenhum dos dois tinha tudo). Esta tela
 * é a composição: recebe funções assíncronas e devolve a tela inteira.
 *
 * Tudo além das mensagens de boas-vindas/despedida é **opcional por capacidade**: sem
 * `getTopics`, a seção de tópicos não existe; sem `listTemplates`, a aba de templates não
 * aparece; sem `createTemplate`, o submenu de criação some. Nada de aba que abre em branco.
 */

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { WelcomeFarewellForm, type WelcomeFarewellFormLabels } from './WelcomeFarewellForm'
import { TopicsForm, type TopicItem, type TopicsFormLabels } from './TopicsForm'
import {
  WhatsAppTemplatesSettings,
  type WhatsAppTemplatesSettingsLabels,
} from './WhatsAppTemplatesSettings'
import type {
  WhatsAppTemplateSummary,
  WhatsAppTemplateVariableSuggestion,
  WhatsAppTemplateSettingsFormLabels,
} from './WhatsAppTemplateSettingsForm'
import type {
  WhatsAppCreateTemplateFormLabels,
  WhatsAppCreateTemplateResult,
  WhatsAppCreateTemplateState,
} from './WhatsAppCreateTemplateForm'
import {
  TranscriptionSettingsForm,
  type TranscriptionSettingsFormLabels,
} from './TranscriptionSettingsForm'
import type { TranscriptionMode } from '../types'
import { TooltipLayer } from '../Tooltip'

export interface BotMessages {
  welcomeMessage: string
  farewellMessage: string
}

export interface TemplateSettings {
  templateName: string
  templateLanguage: string
  variables: string[]
}

export interface TranscriptionSettings {
  enabled: boolean
  mode: TranscriptionMode
  available: boolean
}

export interface MessagesWorkspaceApi {
  getMessages(): Promise<BotMessages>
  saveMessages(messages: BotMessages): Promise<void>
  /** Sem este par, a seção de tópicos não é desenhada. */
  getTopics?(): Promise<TopicItem[]>
  saveTopics?(topics: TopicItem[]): Promise<void>
  /** Sem este par, a aba de templates não é desenhada. */
  getTemplateSettings?(): Promise<TemplateSettings>
  saveTemplateSettings?(settings: TemplateSettings): Promise<void>
  /**
   * Lista de templates aprovados na Meta. Ausente, a aba ainda existe (dá para salvar o nome
   * escolhido), mas nasce sem opções e sem botão de recarregar.
   */
  listTemplates?(): Promise<WhatsAppTemplateSummary[]>
  /** Sem isto, o submenu "Criar template" some. */
  createTemplate?(input: WhatsAppCreateTemplateState): Promise<WhatsAppCreateTemplateResult>
  /** Sem este par, a aba de transcrição não é desenhada. */
  getTranscription?(): Promise<TranscriptionSettings>
  saveTranscription?(settings: Omit<TranscriptionSettings, 'available'>): Promise<void>
}

export interface MessagesWorkspaceLabels {
  title: string
  subtitle: string
  loading: string
  loadError: string
  tabBot: string
  tabTemplates: string
  tabTranscription: string
  welcomeFarewell: Partial<WelcomeFarewellFormLabels>
  topics: Partial<TopicsFormLabels>
  templates: Partial<WhatsAppTemplatesSettingsLabels>
  templateSettings: Partial<WhatsAppTemplateSettingsFormLabels>
  createTemplate: Partial<WhatsAppCreateTemplateFormLabels>
  transcription: Partial<TranscriptionSettingsFormLabels>
}

const DEFAULT_LABELS: MessagesWorkspaceLabels = {
  title: 'Mensagens',
  subtitle: 'Mensagens do bot e templates do WhatsApp.',
  loading: 'Carregando configurações…',
  loadError: 'Não foi possível carregar as configurações de mensagens.',
  tabBot: 'Mensagens do Bot',
  tabTemplates: 'Templates WhatsApp',
  tabTranscription: 'Transcrição de áudio',
  welcomeFarewell: {},
  topics: {},
  templates: {},
  templateSettings: {},
  createTemplate: {},
  transcription: {},
}

const MESSAGES_TAB = {
  BOT: 'bot',
  TEMPLATES: 'templates',
  TRANSCRIPTION: 'transcription',
} as const
type MessagesTab = (typeof MESSAGES_TAB)[keyof typeof MESSAGES_TAB]

const EMPTY_MESSAGES: BotMessages = { welcomeMessage: '', farewellMessage: '' }
const EMPTY_TEMPLATE_SETTINGS: TemplateSettings = {
  templateName: '',
  templateLanguage: 'pt_BR',
  variables: [],
}
const EMPTY_CREATE_TEMPLATE: WhatsAppCreateTemplateState = {
  name: '',
  category: 'UTILITY',
  language: 'pt_BR',
  headerType: 'NONE',
  headerText: '',
  bodyText: '',
  footerText: '',
}

/**
 * Padrão da instalação quando ninguém decidiu ainda.
 *
 * O servidor guarda `null` de propósito (herda o ambiente), mas o interruptor é booleano —
 * `false` é a leitura honesta de "ninguém ligou aqui"; marcado sugeriria escolha que não houve.
 */
const UNDECIDED_TRANSCRIPTION: TranscriptionSettings = {
  enabled: false,
  mode: 'onDemand',
  available: false,
}

const SAVE_FEEDBACK_MS = 3000

export interface MessagesWorkspaceProps {
  readonly api: MessagesWorkspaceApi
  readonly labels?: Partial<MessagesWorkspaceLabels>
  readonly welcomePlaceholders?: readonly string[]
  readonly farewellPlaceholders?: readonly string[]
  readonly availableVariables?: WhatsAppTemplateVariableSuggestion[]
  /** Aviso do produto acima da aba de templates (ex.: rota da Graph API ainda não implementada). */
  readonly renderTemplatesNotice?: () => ReactNode
  readonly className?: string
}

export function MessagesWorkspace({
  api,
  labels: labelsOverride,
  welcomePlaceholders,
  farewellPlaceholders,
  availableVariables,
  renderTemplatesNotice,
  className,
}: MessagesWorkspaceProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsOverride }

  const hasTopics = Boolean(api.getTopics && api.saveTopics)
  const hasTemplates = Boolean(api.getTemplateSettings && api.saveTemplateSettings)
  const hasTranscription = Boolean(api.getTranscription && api.saveTranscription)

  const [tab, setTab] = useState<MessagesTab>(MESSAGES_TAB.BOT)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')

  const [messages, setMessages] = useState<BotMessages>(EMPTY_MESSAGES)
  const [savingMessages, setSavingMessages] = useState(false)
  const [messagesSaved, setMessagesSaved] = useState(false)

  const [topics, setTopics] = useState<TopicItem[]>([])
  const [savingTopics, setSavingTopics] = useState(false)
  const [topicsSaved, setTopicsSaved] = useState(false)

  const [templateSettings, setTemplateSettings] = useState<TemplateSettings>(EMPTY_TEMPLATE_SETTINGS)
  const [templates, setTemplates] = useState<WhatsAppTemplateSummary[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [templatesError, setTemplatesError] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateSaved, setTemplateSaved] = useState(false)

  const [createTemplate, setCreateTemplate] = useState<WhatsAppCreateTemplateState>(EMPTY_CREATE_TEMPLATE)
  const [creatingTemplate, setCreatingTemplate] = useState(false)
  const [createResult, setCreateResult] = useState<WhatsAppCreateTemplateResult | null>(null)

  const [transcription, setTranscription] = useState<TranscriptionSettings>(UNDECIDED_TRANSCRIPTION)
  const [savingTranscription, setSavingTranscription] = useState(false)
  const [transcriptionSaved, setTranscriptionSaved] = useState(false)

  const reloadTemplates = useCallback(async () => {
    if (!api.listTemplates) return
    setLoadingTemplates(true)
    setTemplatesError(false)
    try {
      setTemplates(await api.listTemplates())
    } catch {
      setTemplatesError(true)
    } finally {
      setLoadingTemplates(false)
    }
  }, [api])

  useEffect(() => {
    let active = true
    async function load(): Promise<void> {
      try {
        const [loadedMessages, loadedTopics, loadedTemplateSettings, loadedTranscription] = await Promise.all([
          api.getMessages(),
          api.getTopics?.(),
          api.getTemplateSettings?.(),
          api.getTranscription?.(),
        ])
        if (!active) return
        setMessages(loadedMessages)
        if (loadedTopics) setTopics(loadedTopics)
        if (loadedTemplateSettings) setTemplateSettings(loadedTemplateSettings)
        if (loadedTranscription) setTranscription(loadedTranscription)
        setLoadState('ready')
      } catch {
        if (active) setLoadState('error')
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [api])

  // A lista de templates é buscada à parte porque falha sozinha: a Graph API cai, ou a rota nem
  // existe no produto, e nada disso pode impedir a tela de abrir para salvar o resto.
  useEffect(() => {
    void reloadTemplates()
  }, [reloadTemplates])

  function flash(setter: (value: boolean) => void): void {
    setter(true)
    setTimeout(() => setter(false), SAVE_FEEDBACK_MS)
  }

  async function handleSaveMessages(event: FormEvent): Promise<void> {
    event.preventDefault()
    setSavingMessages(true)
    try {
      await api.saveMessages(messages)
      flash(setMessagesSaved)
    } finally {
      setSavingMessages(false)
    }
  }

  async function handleSaveTopics(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!api.saveTopics) return
    setSavingTopics(true)
    try {
      await api.saveTopics(topics)
      flash(setTopicsSaved)
    } finally {
      setSavingTopics(false)
    }
  }

  async function handleSaveTemplate(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!api.saveTemplateSettings) return
    setSavingTemplate(true)
    try {
      await api.saveTemplateSettings(templateSettings)
      flash(setTemplateSaved)
    } finally {
      setSavingTemplate(false)
    }
  }

  async function handleCreateTemplate(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!api.createTemplate) return
    setCreatingTemplate(true)
    setCreateResult(null)
    try {
      const result = await api.createTemplate(createTemplate)
      setCreateResult(result)
      if (result.ok) {
        setCreateTemplate(EMPTY_CREATE_TEMPLATE)
        void reloadTemplates()
      }
    } catch (error) {
      setCreateResult({ ok: false, message: error instanceof Error ? error.message : '' })
    } finally {
      setCreatingTemplate(false)
    }
  }

  async function handleSaveTranscription(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!api.saveTranscription) return
    setSavingTranscription(true)
    try {
      await api.saveTranscription({ enabled: transcription.enabled, mode: transcription.mode })
      flash(setTranscriptionSaved)
    } finally {
      setSavingTranscription(false)
    }
  }

  function handleSelectTemplate(name: string, template: WhatsAppTemplateSummary | undefined): void {
    setTemplateSettings((previous) => {
      if (!template) return { ...previous, templateName: name }
      // Escolher um template com variáveis e deixar a lista vazia é o erro clássico: o envio
      // vai à Meta sem os parâmetros e volta rejeitado. Pré-abrir os campos evita isso — mas só
      // quando ninguém preencheu nada ainda, para não apagar mapeamento existente.
      const shouldSeedVariables = template.variableCount > 0 && previous.variables.length === 0
      return {
        templateName: name,
        templateLanguage: template.language,
        variables: shouldSeedVariables
          ? Array.from({ length: template.variableCount }, () => '')
          : previous.variables,
      }
    })
  }

  if (loadState === 'loading') {
    return <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{labels.loading}</p>
  }
  if (loadState === 'error') {
    return (
      <p role="alert" className="p-6 text-sm text-red-600 dark:text-red-400">
        {labels.loadError}
      </p>
    )
  }

  const tabs: { id: MessagesTab; label: string }[] = [
    { id: MESSAGES_TAB.BOT, label: labels.tabBot },
    ...(hasTemplates ? [{ id: MESSAGES_TAB.TEMPLATES, label: labels.tabTemplates }] : []),
    ...(hasTranscription ? [{ id: MESSAGES_TAB.TRANSCRIPTION, label: labels.tabTranscription }] : []),
  ]

  return (
    <div className={`space-y-6 p-4 lg:p-0 ${className ?? ''}`}>
      <TooltipLayer />
      <header>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{labels.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{labels.subtitle}</p>
      </header>

      {/* Uma aba só não é navegação: vira ruído com aparência de escolha. */}
      {tabs.length > 1 ? (
        <nav className="flex gap-1 border-b border-gray-200 dark:border-gray-700" role="tablist">
          {tabs.map((item) => (
            <button
              data-cv-tooltip={item.label} aria-label={item.label}
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === item.id
                  ? 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      ) : null}

      {tab === MESSAGES_TAB.BOT ? (
        <div className="space-y-8">
          <WelcomeFarewellForm
            welcomeMessage={messages.welcomeMessage}
            onWelcomeMessageChange={(welcomeMessage) =>
              setMessages((previous) => ({ ...previous, welcomeMessage }))
            }
            farewellMessage={messages.farewellMessage}
            onFarewellMessageChange={(farewellMessage) =>
              setMessages((previous) => ({ ...previous, farewellMessage }))
            }
            onSave={handleSaveMessages}
            saving={savingMessages}
            saveSuccess={messagesSaved}
            labels={labels.welcomeFarewell}
            {...(welcomePlaceholders ? { welcomePlaceholders } : {})}
            {...(farewellPlaceholders ? { farewellPlaceholders } : {})}
          />

          {hasTopics ? (
            <TopicsForm
              topics={topics}
              onToggle={(key) =>
                setTopics((previous) =>
                  previous.map((topic) => (topic.key === key ? { ...topic, enabled: !topic.enabled } : topic)),
                )
              }
              onMessageChange={(key, message) =>
                setTopics((previous) =>
                  previous.map((topic) => (topic.key === key ? { ...topic, message } : topic)),
                )
              }
              onSave={handleSaveTopics}
              saving={savingTopics}
              saveSuccess={topicsSaved}
              labels={labels.topics}
            />
          ) : null}
        </div>
      ) : null}

      {tab === MESSAGES_TAB.TEMPLATES ? (
        <div className="space-y-4">
          {renderTemplatesNotice?.()}
          <WhatsAppTemplatesSettings
            templates={templates}
            loadingTemplates={loadingTemplates}
            templatesError={templatesError}
            selectedTemplateName={templateSettings.templateName}
            onSelectTemplate={handleSelectTemplate}
            variables={templateSettings.variables}
            onVariablesChange={(variables) => setTemplateSettings((previous) => ({ ...previous, variables }))}
            onSave={handleSaveTemplate}
            saving={savingTemplate}
            saveSuccess={templateSaved}
            labels={labels.templates}
            settingsLabels={labels.templateSettings}
            {...(api.listTemplates ? { onRefreshTemplates: () => void reloadTemplates() } : {})}
            {...(availableVariables ? { availableVariables } : {})}
            {...(api.createTemplate
              ? {
                  create: {
                    value: createTemplate,
                    onChange: setCreateTemplate,
                    onSubmit: handleCreateTemplate,
                    submitting: creatingTemplate,
                    result: createResult,
                    labels: labels.createTemplate,
                  },
                }
              : {})}
          />
        </div>
      ) : null}

      {tab === MESSAGES_TAB.TRANSCRIPTION ? (
        <TranscriptionSettingsForm
          enabled={transcription.enabled}
          onEnabledChange={(enabled) => setTranscription((previous) => ({ ...previous, enabled }))}
          mode={transcription.mode}
          onModeChange={(mode) => setTranscription((previous) => ({ ...previous, mode }))}
          onSave={handleSaveTranscription}
          isAvailable={transcription.available}
          saving={savingTranscription}
          saveSuccess={transcriptionSaved}
          labels={labels.transcription}
        />
      ) : null}
    </div>
  )
}
