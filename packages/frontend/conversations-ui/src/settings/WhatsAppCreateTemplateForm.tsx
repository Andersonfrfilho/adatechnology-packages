import type { FormEvent } from 'react'
import { SendHorizonal } from 'lucide-react'

export type WhatsAppTemplateHeaderType = 'NONE' | 'TEXT'

export interface WhatsAppCreateTemplateState {
  name: string
  category: string
  language: string
  headerType: WhatsAppTemplateHeaderType
  headerText: string
  bodyText: string
  footerText: string
}

export interface WhatsAppCreateTemplateResult {
  ok: boolean
  message: string
  status?: string
}

export interface WhatsAppCreateTemplateFormLabels {
  sectionTitle: string
  sectionDescription: string
  nameLabel: string
  nameHint: string
  namePlaceholder: string
  categoryLabel: string
  languageLabel: string
  headerLabel: string
  headerHint: string
  headerNone: string
  headerText: string
  headerPlaceholder: string
  bodyLabel: string
  bodyHint: string
  bodyPlaceholder: string
  detectedVariables: string
  variableLabel: (index: number) => string
  configureHintPrefix: string
  configureHintLink: string
  configureHintSuffix: string
  footerLabel: string
  footerHint: string
  footerPlaceholder: string
  previewLabel: string
  previewOnline: string
  previewDescription: string
  previewHeaderFallback: string
  previewBodyPlaceholder: string
  sendForApproval: string
  sending: string
  successStatus: (status: string) => string
}

const DEFAULT_LABELS: WhatsAppCreateTemplateFormLabels = {
  sectionTitle: 'Criar novo template',
  sectionDescription: 'Envia um template para aprovação da Meta.',
  nameLabel: 'Nome do template',
  nameHint: 'Somente letras minúsculas, números e underscore.',
  namePlaceholder: 'reengajamento_cliente',
  categoryLabel: 'Categoria',
  languageLabel: 'Idioma',
  headerLabel: 'Cabeçalho',
  headerHint: 'Opcional — texto fixo exibido acima do corpo.',
  headerNone: 'Sem cabeçalho',
  headerText: 'Texto',
  headerPlaceholder: 'Ex: Olá {{1}}!',
  bodyLabel: 'Corpo da mensagem',
  bodyHint: 'Use {{1}}, {{2}}... para variáveis dinâmicas.',
  bodyPlaceholder: 'Ex: Olá {{1}}, sua simulação para {{2}} está pronta.',
  detectedVariables: 'Variáveis detectadas',
  variableLabel: (index: number) => `Variável ${index}`,
  configureHintPrefix: 'Configure o mapeamento em ',
  configureHintLink: 'Template usado para reabrir a janela de 24h',
  configureHintSuffix: ' depois de aprovado.',
  footerLabel: 'Rodapé',
  footerHint: 'Opcional — texto fixo exibido abaixo do corpo.',
  footerPlaceholder: 'Ex: Empresa LTDA',
  previewLabel: 'Prévia',
  previewOnline: 'online',
  previewDescription: 'Assim aparecerá para o cliente no WhatsApp.',
  previewHeaderFallback: 'Cabeçalho',
  previewBodyPlaceholder: 'Corpo da mensagem aparecerá aqui…',
  sendForApproval: 'Enviar para aprovação',
  sending: 'Enviando...',
  successStatus: (status: string) => `Status: ${status}`,
}

export interface WhatsAppCreateTemplateFormProps {
  value: WhatsAppCreateTemplateState
  onChange: (value: WhatsAppCreateTemplateState) => void
  onSubmit: (event: FormEvent) => void
  submitting?: boolean
  result?: WhatsAppCreateTemplateResult | null
  previewCompanyName?: string
  labels?: Partial<WhatsAppCreateTemplateFormLabels>
  variableExamples?: readonly string[]
}

const DEFAULT_VARIABLE_EXAMPLES = ['Nome do cliente', 'Produto', 'Valor', 'Prazo', 'Banco'] as const

function detectVariables(bodyText: string): string[] {
  const matches = bodyText.match(/\{\{(\d+)\}\}/g) ?? []
  return [...new Set(matches.map((token) => token.replace(/[{}]/g, '')))].sort()
}

function fillPreviewTokens(text: string): string {
  return text.replace(/\{\{1\}\}/g, 'João').replace(/\{\{2\}\}/g, 'Imóvel').replace(/\{\{3\}\}/g, 'R$ 1.500')
}

// Paridade com financiamento-imobiliario-bot/apps/web/src/pages/MessagesPage.tsx (aba
// "templates", seção "Criar Novo Template") — puramente apresentacional: onSubmit é o
// único ponto de rede, controlado pelo host via ConversationsApi.
export function WhatsAppCreateTemplateForm({
  value,
  onChange,
  onSubmit,
  submitting = false,
  result,
  previewCompanyName = 'WhatsApp Bot',
  labels: labelsOverride,
  variableExamples = DEFAULT_VARIABLE_EXAMPLES,
}: WhatsAppCreateTemplateFormProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsOverride }
  const detectedVariables = detectVariables(value.bodyText)

  function set<K extends keyof WhatsAppCreateTemplateState>(key: K, next: WhatsAppCreateTemplateState[K]) {
    onChange({ ...value, [key]: next })
  }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{labels.sectionTitle}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{labels.sectionDescription}</p>
      </div>

      <form onSubmit={onSubmit} className="p-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{labels.nameLabel}</label>
          <p className="text-xs text-gray-400 mb-1.5">{labels.nameHint}</p>
          <input
            type="text"
            value={value.name}
            onChange={(e) => set('name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
            placeholder={labels.namePlaceholder}
            className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{labels.categoryLabel}</label>
            <select
              value={value.category}
              onChange={(e) => set('category', e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
            >
              <option value="UTILITY">UTILITY (Transacional)</option>
              <option value="MARKETING">MARKETING (Promocional)</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{labels.languageLabel}</label>
            <select
              value={value.language}
              onChange={(e) => set('language', e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
            >
              <option value="pt_BR">Português (Brasil)</option>
              <option value="en_US">Inglês (EUA)</option>
              <option value="es_ES">Espanhol</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{labels.headerLabel}</label>
          <p className="text-xs text-gray-400 mb-1.5">{labels.headerHint}</p>
          <div className="flex gap-2">
            <select
              value={value.headerType}
              onChange={(e) => set('headerType', e.target.value as WhatsAppTemplateHeaderType)}
              className="border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
            >
              <option value="NONE">{labels.headerNone}</option>
              <option value="TEXT">{labels.headerText}</option>
            </select>
            {value.headerType === 'TEXT' && (
              <input
                type="text"
                value={value.headerText}
                onChange={(e) => set('headerText', e.target.value)}
                placeholder={labels.headerPlaceholder}
                maxLength={60}
                className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
              />
            )}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{labels.bodyLabel}</label>
          <p className="text-xs text-gray-400 mb-1.5">{labels.bodyHint}</p>
          <textarea
            value={value.bodyText}
            onChange={(e) => set('bodyText', e.target.value)}
            placeholder={labels.bodyPlaceholder}
            rows={4}
            className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all resize-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
            required
          />
          {detectedVariables.length > 0 && (
            <div className="mt-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 px-3 py-2">
              <p className="font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide text-xs">{labels.detectedVariables}</p>
              <div className="flex flex-wrap gap-2">
                {detectedVariables.map((num) => (
                  <span key={num} className="inline-flex items-center gap-1 text-xs">
                    <code className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-mono">{`{{${num}}}`}</code>
                    <span className="text-gray-400 dark:text-gray-500">= {variableExamples[Number(num) - 1] ?? labels.variableLabel(Number(num))}</span>
                  </span>
                ))}
              </div>
              <p className="text-gray-400 dark:text-gray-500 mt-1.5 text-xs">
                {labels.configureHintPrefix}<strong>{labels.configureHintLink}</strong>{labels.configureHintSuffix}
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{labels.footerLabel}</label>
          <p className="text-xs text-gray-400 mb-1.5">{labels.footerHint}</p>
          <input
            type="text"
            value={value.footerText}
            onChange={(e) => set('footerText', e.target.value)}
            placeholder={labels.footerPlaceholder}
            maxLength={60}
            className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">{labels.previewLabel}</label>
          <div className="rounded-2xl bg-[#e5ddd5] dark:bg-[#1a1a2e] border border-gray-300 dark:border-gray-600 overflow-hidden shadow-inner">
            <div className="bg-[#075e54] px-4 py-2.5 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">
                {previewCompanyName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-white text-xs font-semibold leading-tight">{previewCompanyName}</p>
                <p className="text-white/60 text-xs">{labels.previewOnline}</p>
              </div>
            </div>
            <div className="px-3 py-4 space-y-3" style={{ minHeight: '120px' }}>
              <div className="flex justify-start" style={{ maxWidth: '85%' }}>
                <div className="bg-white dark:bg-gray-700 rounded-lg rounded-tl-none px-3 py-2 shadow-sm">
                  <p className="text-gray-500 dark:text-gray-400 leading-tight text-sm">{labels.previewDescription}</p>
                  <p className="text-gray-400 dark:text-gray-500 mt-1 text-right text-[9px]">12:00</p>
                </div>
              </div>
              <div className="flex justify-end ml-auto" style={{ maxWidth: '85%' }}>
                <div className="bg-[#dcf8c6] dark:bg-[#1b5e20] rounded-lg rounded-tr-none px-3 py-2 shadow-sm">
                  {value.headerType === 'TEXT' && value.headerText && (
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
                      {fillPreviewTokens(value.headerText) || labels.previewHeaderFallback}
                    </p>
                  )}
                  <p className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed">
                    {value.bodyText ? fillPreviewTokens(value.bodyText) : <span className="text-gray-400 italic">{labels.previewBodyPlaceholder}</span>}
                  </p>
                  {value.footerText && (
                    <p className="text-gray-400 dark:text-gray-400 mt-1 text-xs">{value.footerText}</p>
                  )}
                  <p className="text-gray-400 dark:text-gray-400 mt-1 text-right text-[9px]">12:01 ✓</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {result && (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              result.ok
                ? 'bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
            }`}
          >
            {result.message}
            {result.ok && result.status && <p className="text-xs mt-1 opacity-75">{labels.successStatus(result.status)}</p>}
          </div>
        )}

        <div className="flex justify-end">
          <button
            data-cv-tooltip={submitting ? labels.sending : labels.sendForApproval} aria-label={submitting ? labels.sending : labels.sendForApproval}
            type="submit"
            disabled={submitting || !value.name || !value.bodyText}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            {submitting ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <SendHorizonal size={14} />}
            {submitting ? labels.sending : labels.sendForApproval}
          </button>
        </div>
      </form>
    </section>
  )
}
