/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Estado das mensagens do bot: boas-vindas e encerramento, tópicos e o template de reengajamento.
 *
 * As três áreas salvam separado de propósito. Um botão único economizaria código e trocaria isso por
 * um efeito pior: um erro em qualquer campo faria as três falharem juntas, e quem só queria corrigir
 * uma vírgula na despedida perderia o resto.
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

import { useAsyncResource } from '../hooks/useAsyncResource'
import type { TopicItem } from './TopicsForm'
import type { WhatsAppTemplateSummary } from './WhatsAppTemplateSettingsForm'
import type { WhatsAppCreateTemplateResult, WhatsAppCreateTemplateState } from './WhatsAppCreateTemplateForm'

const SAVE_SUCCESS_LINGER_MS = 3000

const EMPTY_CREATE_TEMPLATE: WhatsAppCreateTemplateState = {
  name: '',
  category: 'MARKETING',
  language: 'pt_BR',
  headerType: 'NONE',
  headerText: '',
  bodyText: '',
  footerText: '',
}

export type CompanyMessages = {
  readonly welcomeMessage: string
  readonly farewellMessage: string
}

export type TemplateSettings = {
  readonly templateName: string
  readonly templateLanguage: string
  readonly variables: readonly string[]
}

/** Só o que a tela precisa do servidor. Nenhuma rota assumida — cada produto tem as suas. */
export type MessagesWorkspaceApi = {
  getMessages: () => Promise<CompanyMessages>
  saveMessages: (input: CompanyMessages) => Promise<void>
  getTopics: () => Promise<readonly TopicItem[]>
  saveTopics: (topics: readonly TopicItem[]) => Promise<void>
  getTemplateSettings: () => Promise<TemplateSettings>
  saveTemplateSettings: (input: TemplateSettings) => Promise<void>
  /** Ausente, a aba de templates não aparece — o produto que não usa WhatsApp não vê a área. */
  listTemplates?: (() => Promise<readonly WhatsAppTemplateSummary[]>) | undefined
  /** Ausente, a aba de criação não aparece: o produto lê templates mas não sabe criar. */
  createTemplate?: ((input: WhatsAppCreateTemplateState) => Promise<WhatsAppCreateTemplateResult>) | undefined
}

/** Um salvamento em curso e a confirmação que vem depois dele. */
type SaveSlot = {
  readonly saving: boolean
  readonly success: boolean
  readonly failure: string | undefined
}

const IDLE: SaveSlot = { saving: false, success: false, failure: undefined }

function useSaveSlot() {
  const [state, setState] = useState<SaveSlot>(IDLE)

  // Confirmação não é estado: sem apagar, o "salvo" fica na tela para sempre e deixa de significar
  // que algo acabou de ser salvo.
  useEffect(() => {
    if (!state.success) return
    const timer = setTimeout(() => setState((previous) => ({ ...previous, success: false })), SAVE_SUCCESS_LINGER_MS)
    return () => clearTimeout(timer)
  }, [state.success])

  const run = useCallback(async (action: () => Promise<void>) => {
    setState({ saving: true, success: false, failure: undefined })
    try {
      await action()
      setState({ saving: false, success: true, failure: undefined })
    } catch (error) {
      setState({ saving: false, success: false, failure: error instanceof Error ? error.message : undefined })
    }
  }, [])

  return { state, run }
}

export function useMessagesEditor(api: MessagesWorkspaceApi) {
  // Mesma razão do editor de fluxos: `api` montada inline no produto viraria referência nova a cada
  // render e a busca entraria em laço.
  const apiRef = useRef(api)
  apiRef.current = api

  const messagesResource = useAsyncResource(() => apiRef.current.getMessages(), [])
  const topicsResource = useAsyncResource(() => apiRef.current.getTopics(), [])
  const templateResource = useAsyncResource(() => apiRef.current.getTemplateSettings(), [])
  const templatesResource = useAsyncResource(() => apiRef.current.listTemplates?.() ?? Promise.resolve([]), [])

  const [messages, setMessages] = useState<CompanyMessages>({ welcomeMessage: '', farewellMessage: '' })
  const [topics, setTopics] = useState<readonly TopicItem[]>([])
  const [template, setTemplate] = useState<TemplateSettings>({
    templateName: '',
    templateLanguage: 'pt_BR',
    variables: [],
  })
  const [createTemplate, setCreateTemplate] = useState<WhatsAppCreateTemplateState>(EMPTY_CREATE_TEMPLATE)
  const [createResult, setCreateResult] = useState<WhatsAppCreateTemplateResult | undefined>(undefined)

  const messagesSave = useSaveSlot()
  const topicsSave = useSaveSlot()
  const templateSave = useSaveSlot()
  const createSave = useSaveSlot()

  // O que veio do servidor semeia o formulário UMA vez por carga. Sincronizar a cada render
  // sobrescreveria o que a pessoa está digitando no meio da frase.
  useEffect(() => {
    if (messagesResource.data) setMessages(messagesResource.data)
  }, [messagesResource.data])

  useEffect(() => {
    if (topicsResource.data) setTopics(topicsResource.data)
  }, [topicsResource.data])

  useEffect(() => {
    if (templateResource.data) setTemplate(templateResource.data)
  }, [templateResource.data])

  const submitMessages = useCallback(
    (event: FormEvent) => {
      event.preventDefault()
      void messagesSave.run(() => apiRef.current.saveMessages(messages))
    },
    [messages, messagesSave],
  )

  const submitTopics = useCallback(
    (event: FormEvent) => {
      event.preventDefault()
      void topicsSave.run(() => apiRef.current.saveTopics(topics))
    },
    [topics, topicsSave],
  )

  const submitTemplate = useCallback(
    (event: FormEvent) => {
      event.preventDefault()
      void templateSave.run(() => apiRef.current.saveTemplateSettings(template))
    },
    [template, templateSave],
  )

  const submitCreateTemplate = useCallback(
    (event: FormEvent) => {
      event.preventDefault()
      const create = apiRef.current.createTemplate
      if (!create) return

      void createSave.run(async () => {
        const result = await create(createTemplate)
        setCreateResult(result)
        // Só limpa o formulário quando a Meta aceitou: falhou, o texto que a pessoa escreveu
        // continua na tela para ela corrigir em vez de digitar tudo de novo.
        if (result.ok) setCreateTemplate(EMPTY_CREATE_TEMPLATE)
        await templatesResource.refetch()
      })
    },
    [createTemplate, createSave, templatesResource],
  )

  const toggleTopic = useCallback((key: string) => {
    setTopics((previous) => previous.map((each) => (each.key === key ? { ...each, enabled: !each.enabled } : each)))
  }, [])

  const changeTopicMessage = useCallback((key: string, message: string) => {
    setTopics((previous) => previous.map((each) => (each.key === key ? { ...each, message } : each)))
  }, [])

  const selectTemplate = useCallback((name: string) => {
    setTemplate((previous) => ({ ...previous, templateName: name }))
  }, [])

  const changeVariables = useCallback((variables: string[]) => {
    setTemplate((previous) => ({ ...previous, variables }))
  }, [])

  return {
    loading: messagesResource.loading && messagesResource.data === undefined,
    messages,
    setWelcomeMessage: useCallback(
      (welcomeMessage: string) => setMessages((previous) => ({ ...previous, welcomeMessage })),
      [],
    ),
    setFarewellMessage: useCallback(
      (farewellMessage: string) => setMessages((previous) => ({ ...previous, farewellMessage })),
      [],
    ),
    messagesSave: messagesSave.state,
    submitMessages,

    topics,
    toggleTopic,
    changeTopicMessage,
    topicsSave: topicsSave.state,
    submitTopics,

    template,
    selectTemplate,
    changeVariables,
    templateSave: templateSave.state,
    submitTemplate,

    templates: templatesResource.data ?? [],
    templatesLoading: templatesResource.loading,
    templatesError: templatesResource.error !== undefined,
    refreshTemplates: templatesResource.refetch,

    createTemplate,
    setCreateTemplate,
    createResult,
    createSave: createSave.state,
    submitCreateTemplate,
  }
}

export type MessagesEditor = ReturnType<typeof useMessagesEditor>
