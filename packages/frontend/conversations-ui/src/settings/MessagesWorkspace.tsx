/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A tela inteira de mensagens do bot: abas, estado, salvamento e os três formulários.
 *
 * É o que o produto consome — inteira, nunca em pedaços (`pluggable-module.md` §4). O pacote já
 * exportava os formulários, e o resultado foi cada produto remontando abas e estado por conta: o
 * financiamento tinha 300 linhas de página para compor peças que já existiam aqui.
 */

import { useMemo, useState, type ReactNode } from 'react'

import { cn } from '../lib/cn'
import { TopicsForm, type TopicsFormLabels } from './TopicsForm'
import { WelcomeFarewellForm, type WelcomeFarewellFormLabels } from './WelcomeFarewellForm'
import type { WhatsAppTemplateVariableSuggestion } from './WhatsAppTemplateSettingsForm'
import { WhatsAppTemplatesSettings, type WhatsAppTemplatesSettingsLabels } from './WhatsAppTemplatesSettings'
import { useMessagesEditor, type MessagesWorkspaceApi } from './useMessagesEditor'

const MESSAGES_TAB = { bot: 'bot', templates: 'templates' } as const
type MessagesTab = (typeof MESSAGES_TAB)[keyof typeof MESSAGES_TAB]

export type MessagesWorkspaceLabels = {
  title: string
  subtitle: string
  tabBot: string
  tabTemplates: string
  loading: string
  welcomeFarewell: Partial<WelcomeFarewellFormLabels>
  topics: Partial<TopicsFormLabels>
  templates: Partial<WhatsAppTemplatesSettingsLabels>
}

const DEFAULT_LABELS: MessagesWorkspaceLabels = {
  title: 'Mensagens',
  subtitle: 'O que o bot diz, e quando',
  tabBot: 'Mensagens do bot',
  tabTemplates: 'Templates do WhatsApp',
  loading: 'Carregando…',
  welcomeFarewell: {},
  topics: {},
  templates: {},
}

export type MessagesWorkspaceProps = {
  readonly api: MessagesWorkspaceApi
  readonly labels?: Partial<MessagesWorkspaceLabels>
  /** Variáveis que o bot deste produto resolve na mensagem — o pacote não conhece nenhuma. */
  readonly availableVariables?: readonly WhatsAppTemplateVariableSuggestion[]
  /** Marcadores que o produto substitui na mensagem, oferecidos como atalho ao lado do campo. */
  readonly welcomePlaceholders?: readonly string[]
  readonly farewellPlaceholders?: readonly string[]
  /**
   * Aviso acima da área de templates.
   *
   * Slot porque o motivo é sempre do produto: um deles ainda não tem a rota que consulta a Graph API,
   * e sem explicação o seletor vazio se lê como defeito do pacote.
   */
  readonly renderTemplatesNotice?: (() => ReactNode) | undefined
  readonly className?: string
}

export function MessagesWorkspace(props: MessagesWorkspaceProps) {
  const { api, availableVariables, welcomePlaceholders, farewellPlaceholders, renderTemplatesNotice, className } = props
  const labels = useMemo<MessagesWorkspaceLabels>(() => ({ ...DEFAULT_LABELS, ...props.labels }), [props.labels])

  const editor = useMessagesEditor(api)
  const [tab, setTab] = useState<MessagesTab>(MESSAGES_TAB.bot)

  /**
   * A aba de templates segue `getTemplateSettings`, não `listTemplates`.
   *
   * São capacidades diferentes: salvar QUAL template usar não depende de conseguir listar os
   * aprovados na Meta. Amarrar a aba à listagem tirava de um produto real a única forma de configurar
   * o envio, só porque a rota de listagem ainda não existe lá.
   */
  const hasTemplates = api.getTemplateSettings !== undefined
  const hasTopics = api.getTopics !== undefined && editor.topics.length > 0

  return (
    <div className={cn('cv-messages', className)}>
      <header className="cv-workspace-header cv-messages-header">
        <div>
          <h2>{labels.title}</h2>
          <p>{labels.subtitle}</p>
        </div>
      </header>

      {hasTemplates && (
        <div className="cv-messages-tabs">
          <button
            type="button"
            className={cn('cv-subtab', tab === MESSAGES_TAB.bot && 'cv-subtab--active')}
            onClick={() => setTab(MESSAGES_TAB.bot)}
          >
            {labels.tabBot}
          </button>
          <button
            type="button"
            className={cn('cv-subtab', tab === MESSAGES_TAB.templates && 'cv-subtab--active')}
            onClick={() => setTab(MESSAGES_TAB.templates)}
          >
            {labels.tabTemplates}
          </button>
        </div>
      )}

      {editor.loading && <p className="cv-workspace-empty">{labels.loading}</p>}

      {!editor.loading && tab === MESSAGES_TAB.bot && (
        <div className="cv-messages-sections">
          <WelcomeFarewellForm
            welcomeMessage={editor.messages.welcomeMessage}
            onWelcomeMessageChange={editor.setWelcomeMessage}
            farewellMessage={editor.messages.farewellMessage}
            onFarewellMessageChange={editor.setFarewellMessage}
            onSave={editor.submitMessages}
            saving={editor.messagesSave.saving}
            saveSuccess={editor.messagesSave.success}
            labels={labels.welcomeFarewell}
            {...(welcomePlaceholders === undefined ? {} : { welcomePlaceholders })}
            {...(farewellPlaceholders === undefined ? {} : { farewellPlaceholders })}
          />
          {editor.messagesSave.failure && <p className="cv-workspace-failure">{editor.messagesSave.failure}</p>}

          {/* Tópicos só aparecem quando o produto tem a rota E devolveu algum: seção vazia se lê como
              tela quebrada, e um produto sem assuntos intermediários não deve nem ver a área. */}
          {hasTopics && (
            <>
              <TopicsForm
                topics={[...editor.topics]}
                onToggle={editor.toggleTopic}
                onMessageChange={editor.changeTopicMessage}
                onSave={editor.submitTopics}
                saving={editor.topicsSave.saving}
                saveSuccess={editor.topicsSave.success}
                labels={labels.topics}
              />
              {editor.topicsSave.failure && <p className="cv-workspace-failure">{editor.topicsSave.failure}</p>}
            </>
          )}
        </div>
      )}

      {!editor.loading && hasTemplates && tab === MESSAGES_TAB.templates && (
        <div className="cv-messages-sections">
          {renderTemplatesNotice?.()}
          <WhatsAppTemplatesSettings
            templates={[...editor.templates]}
            loadingTemplates={editor.templatesLoading}
            templatesError={editor.templatesError}
            onRefreshTemplates={() => void editor.refreshTemplates()}
            selectedTemplateName={editor.template.templateName}
            onSelectTemplate={(name) => editor.selectTemplate(name)}
            variables={[...editor.template.variables]}
            onVariablesChange={editor.changeVariables}
            {...(availableVariables === undefined ? {} : { availableVariables: [...availableVariables] })}
            saving={editor.templateSave.saving}
            saveSuccess={editor.templateSave.success}
            onSave={editor.submitTemplate}
            labels={labels.templates}
            {...(api.createTemplate === undefined
              ? {}
              : {
                  create: {
                    value: editor.createTemplate,
                    onChange: editor.setCreateTemplate,
                    onSubmit: editor.submitCreateTemplate,
                    submitting: editor.createSave.saving,
                    result: editor.createResult ?? null,
                  },
                })}
          />
          {editor.templateSave.failure && <p className="cv-workspace-failure">{editor.templateSave.failure}</p>}
        </div>
      )}
    </div>
  )
}
