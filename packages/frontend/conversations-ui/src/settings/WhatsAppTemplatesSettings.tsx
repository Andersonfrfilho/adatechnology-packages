/**
 * Configurações de template do WhatsApp, com submenu próprio.
 *
 * Junta as duas telas que já existiam soltas — escolher o template de reengajamento e criar um novo
 * para aprovação da Meta — porque na cabeça de quem opera é um só assunto. Cada host montava esse
 * agrupamento por conta, e é justamente o tipo de composição que deve nascer no pacote.
 *
 * Segue presentacional: nenhuma chamada de rede aqui. Templates, estado e handlers vêm por props.
 */

import { useState, type FormEvent } from 'react'
import {
  WhatsAppTemplateSettingsForm,
  type WhatsAppTemplateSummary,
  type WhatsAppTemplateVariableSuggestion,
  type WhatsAppTemplateSettingsFormLabels,
} from './WhatsAppTemplateSettingsForm'
import {
  WhatsAppCreateTemplateForm,
  type WhatsAppCreateTemplateFormLabels,
  type WhatsAppCreateTemplateResult,
  type WhatsAppCreateTemplateState,
} from './WhatsAppCreateTemplateForm'

export const TEMPLATE_SETTINGS_TAB = {
  SELECT: 'select',
  CREATE: 'create',
} as const
export type TemplateSettingsTab = (typeof TEMPLATE_SETTINGS_TAB)[keyof typeof TEMPLATE_SETTINGS_TAB]

export interface WhatsAppTemplatesSettingsLabels {
  selectTab: string
  createTab: string
}

export const DEFAULT_TEMPLATES_SETTINGS_LABELS: WhatsAppTemplatesSettingsLabels = {
  selectTab: 'Template de reengajamento',
  createTab: 'Criar template',
}

export interface WhatsAppTemplatesSettingsProps {
  templates: WhatsAppTemplateSummary[]
  loadingTemplates?: boolean
  templatesError?: boolean
  onRefreshTemplates?: () => void
  selectedTemplateName: string
  onSelectTemplate: (name: string, template: WhatsAppTemplateSummary | undefined) => void
  variables: string[]
  onVariablesChange: (variables: string[]) => void
  availableVariables?: WhatsAppTemplateVariableSuggestion[]
  saving?: boolean
  saveSuccess?: boolean
  onSave: (event: FormEvent) => void
  /** Ausente = host não sabe criar template; a aba de criação nem aparece. */
  create?: {
    value: WhatsAppCreateTemplateState
    onChange: (value: WhatsAppCreateTemplateState) => void
    onSubmit: (event: FormEvent) => void
    submitting?: boolean
    result?: WhatsAppCreateTemplateResult | null
    labels?: Partial<WhatsAppCreateTemplateFormLabels>
  }
  labels?: Partial<WhatsAppTemplatesSettingsLabels>
  /** Vocabulário do formulário de seleção — separado de `labels`, que nomeia só as abas daqui. */
  settingsLabels?: Partial<WhatsAppTemplateSettingsFormLabels>
}

export function WhatsAppTemplatesSettings({
  labels: labelsOverride,
  settingsLabels,
  create,
  ...settingsProps
}: WhatsAppTemplatesSettingsProps) {
  const labels = { ...DEFAULT_TEMPLATES_SETTINGS_LABELS, ...labelsOverride }
  const [tab, setTab] = useState<TemplateSettingsTab>(TEMPLATE_SETTINGS_TAB.SELECT)

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 border-b" role="tablist">
        <button
          data-cv-tooltip={labels.selectTab} aria-label={labels.selectTab}
          type="button"
          role="tab"
          aria-selected={tab === TEMPLATE_SETTINGS_TAB.SELECT}
          onClick={() => setTab(TEMPLATE_SETTINGS_TAB.SELECT)}
          className={`cv-subtab ${tab === TEMPLATE_SETTINGS_TAB.SELECT ? 'cv-subtab--active' : ''}`}
        >
          {labels.selectTab}
        </button>

        {/* A aba de criação só existe se o host souber criar: sem handler, ela seria um formulário
            que não leva a nada. */}
        {create ? (
          <button
            data-cv-tooltip={labels.createTab} aria-label={labels.createTab}
            type="button"
            role="tab"
            aria-selected={tab === TEMPLATE_SETTINGS_TAB.CREATE}
            onClick={() => setTab(TEMPLATE_SETTINGS_TAB.CREATE)}
            className={`cv-subtab ${tab === TEMPLATE_SETTINGS_TAB.CREATE ? 'cv-subtab--active' : ''}`}
          >
            {labels.createTab}
          </button>
        ) : null}
      </nav>

      {tab === TEMPLATE_SETTINGS_TAB.SELECT ? (
        <WhatsAppTemplateSettingsForm {...settingsProps} {...(settingsLabels ? { labels: settingsLabels } : {})} />
      ) : create ? (
        <WhatsAppCreateTemplateForm {...create} />
      ) : null}
    </div>
  )
}
