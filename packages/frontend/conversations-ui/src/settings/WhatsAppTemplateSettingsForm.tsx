import type { FormEvent } from 'react'
import { Plus, RefreshCw, Save, Trash2 } from 'lucide-react'

export interface WhatsAppTemplateSummary {
  name: string
  language: string
  displayName: string
  shortId: string
  status: string
  bodyText: string | null
  variableCount: number
}

export interface WhatsAppTemplateVariableSuggestion {
  token: string
  label: string
}

export interface WhatsAppTemplateSettingsFormLabels {
  sectionTitle: string
  sectionDescription: string
  templateLabel: string
  refreshList: string
  errorLoading: string
  currentNameSaved: string
  selectPlaceholder: string
  variablesLabel: string
  addVariable: string
  removeVariable: string
  variablesAvailableTitle: string
  variablesAvailableHint: string
  variablesMappingHint: string
  noVariables: string
  save: string
  saving: string
  saveSuccess: string
}

const DEFAULT_LABELS: WhatsAppTemplateSettingsFormLabels = {
  sectionTitle: 'WhatsApp',
  sectionDescription: 'Template usado para reabrir a janela de 24h com o cliente.',
  templateLabel: 'Template aprovado',
  refreshList: 'Atualizar lista',
  errorLoading: 'Não foi possível carregar os templates da Meta.',
  currentNameSaved: 'Nome salvo atualmente:',
  selectPlaceholder: 'Selecione um template…',
  variablesLabel: 'Variáveis do template',
  addVariable: 'Adicionar',
  removeVariable: 'Remover variável',
  variablesAvailableTitle: 'Variáveis disponíveis',
  variablesAvailableHint: 'Clique para inserir na próxima variável vazia.',
  variablesMappingHint: 'A ordem das variáveis abaixo deve corresponder à ordem {{1}}, {{2}}... do template.',
  noVariables: 'Este template não tem variáveis.',
  save: 'Salvar',
  saving: 'Salvando...',
  saveSuccess: 'Configuração salva com sucesso.',
}

export interface WhatsAppTemplateSettingsFormProps {
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
  labels?: Partial<WhatsAppTemplateSettingsFormLabels>
}

// Paridade com financiamento-imobiliario-bot/apps/web/src/pages/MessagesPage.tsx (aba
// "templates", seção WhatsApp) — puramente apresentacional: o host busca os templates da
// Meta e persiste a seleção via seu próprio ConversationsApi/backend, injetando aqui só
// dados e callbacks. Nenhuma chamada de rede acontece dentro deste componente.
export function WhatsAppTemplateSettingsForm({
  templates,
  loadingTemplates = false,
  templatesError = false,
  onRefreshTemplates,
  selectedTemplateName,
  onSelectTemplate,
  variables,
  onVariablesChange,
  availableVariables = [],
  saving = false,
  saveSuccess = false,
  onSave,
  labels: labelsOverride,
}: WhatsAppTemplateSettingsFormProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsOverride }
  const selected = templates.find((template) => template.name === selectedTemplateName)

  function handleSelect(name: string) {
    const template = templates.find((t) => t.name === name)
    onSelectTemplate(name, template)
  }

  function updateVariable(index: number, value: string) {
    const next = [...variables]
    next[index] = value
    onVariablesChange(next)
  }

  function removeVariable(index: number) {
    onVariablesChange(variables.filter((_, i) => i !== index))
  }

  function insertVariable(token: string) {
    const emptyIndex = variables.findIndex((value) => !value.trim())
    if (emptyIndex >= 0) {
      const next = [...variables]
      next[emptyIndex] = token
      onVariablesChange(next)
      return
    }
    onVariablesChange([...variables, token])
  }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{labels.sectionTitle}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{labels.sectionDescription}</p>
      </div>

      <form onSubmit={onSave} className="p-6 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{labels.templateLabel}</label>
            <button
              data-cv-tooltip={labels.refreshList} aria-label={labels.refreshList}
              type="button"
              onClick={onRefreshTemplates}
              disabled={loadingTemplates}
              className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
            >
              <RefreshCw size={11} className={loadingTemplates ? 'animate-spin' : ''} />
              {labels.refreshList}
            </button>
          </div>

          {templatesError && (
            <div className="mb-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              {labels.errorLoading}
              <br />
              <span className="text-gray-500 dark:text-gray-400 mt-0.5 block">
                {labels.currentNameSaved} <strong>{selectedTemplateName || '—'}</strong>
              </span>
            </div>
          )}

          {loadingTemplates && <div className="h-10 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse" />}

          {!loadingTemplates && !templatesError && (
            <select
              value={selectedTemplateName}
              onChange={(e) => handleSelect(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
            >
              <option value="">{labels.selectPlaceholder}</option>
              {templates.map((template) => (
                <option key={`${template.name}-${template.language}`} value={template.name} disabled={template.status !== 'APPROVED'}>
                  {template.displayName} · {template.shortId} ({template.language}) {template.status !== 'APPROVED' ? `[${template.status}]` : ''}
                </option>
              ))}
            </select>
          )}

          {selected?.bodyText && (
            <div className="mt-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 px-3 py-2 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
              {selected.bodyText}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{labels.variablesLabel}</label>
            <button
              data-cv-tooltip={labels.addVariable} aria-label={labels.addVariable}
              type="button"
              onClick={() => onVariablesChange([...variables, ''])}
              className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Plus size={12} />
              {labels.addVariable}
            </button>
          </div>

          {availableVariables.length > 0 && (
            <div className="mb-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40 p-2.5">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">{labels.variablesAvailableTitle}</p>
              <div className="flex flex-wrap gap-1.5">
                {availableVariables.map((available) => (
                  <button
                    key={available.token}
                    type="button"
                    onClick={() => insertVariable(available.token)}
                    data-cv-tooltip={`Inserir ${available.token}`} aria-label={`Inserir ${available.token}`}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                  >
                    <code className="text-blue-600 dark:text-blue-300">{available.token}</code>
                    <span className="text-gray-400 dark:text-gray-500">· {available.label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">{labels.variablesAvailableHint}</p>
            </div>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{labels.variablesMappingHint}</p>

          {variables.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">{labels.noVariables}</p>
          )}

          <div className="space-y-2">
            {variables.map((variable, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500 w-6 text-right flex-shrink-0">
                  {`{{${index + 1}}}`}
                </span>
                <input
                  type="text"
                  value={variable}
                  onChange={(e) => updateVariable(index, e.target.value)}
                  placeholder="Ex: {clientName}"
                  className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
                <button
                  type="button"
                  onClick={() => removeVariable(index)}
                  className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
                  data-cv-tooltip={labels.removeVariable} aria-label={labels.removeVariable}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {saveSuccess && (
          <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 text-sm text-green-700 dark:text-green-400">
            {labels.saveSuccess}
          </div>
        )}

        <div className="flex justify-end">
          <button
            data-cv-tooltip={saving ? labels.saving : labels.save} aria-label={saving ? labels.saving : labels.save}
            type="submit"
            disabled={saving || !selectedTemplateName.trim()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
            {saving ? labels.saving : labels.save}
          </button>
        </div>
      </form>
    </section>
  )
}
