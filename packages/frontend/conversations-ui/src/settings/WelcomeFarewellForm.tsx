import type { FormEvent } from 'react'
import { LogOut, Mail, Save } from 'lucide-react'
import { WhatsAppMessageEditor } from '../WhatsAppMessageEditor'

export interface WelcomeFarewellFormLabels {
  sectionTitle: string
  welcomeMessage: string
  welcomeMessagePlaceholder: string
  welcomeMessageHint: string
  farewellMessage: string
  farewellMessagePlaceholder: string
  farewellMessageHint: string
  save: string
  saving: string
  saveSuccess: string
}

const DEFAULT_LABELS: WelcomeFarewellFormLabels = {
  sectionTitle: 'Boas-vindas e encerramento',
  welcomeMessage: 'Mensagem de boas-vindas',
  welcomeMessagePlaceholder: 'Olá! Sou o assistente virtual da {empresa}...',
  welcomeMessageHint: 'Enviada automaticamente no primeiro contato do cliente.',
  farewellMessage: 'Mensagem de encerramento',
  farewellMessagePlaceholder: 'Obrigado pelo contato! Se precisar de algo, é só chamar.',
  farewellMessageHint: 'Enviada quando o atendente encerra a conversa.',
  save: 'Salvar',
  saving: 'Salvando...',
  saveSuccess: 'Mensagens salvas com sucesso.',
}

export interface WelcomeFarewellFormProps {
  welcomeMessage: string
  onWelcomeMessageChange: (value: string) => void
  farewellMessage: string
  onFarewellMessageChange: (value: string) => void
  onSave: (event: FormEvent) => void
  saving?: boolean
  saveSuccess?: boolean
  welcomePlaceholders?: readonly string[]
  farewellPlaceholders?: readonly string[]
  labels?: Partial<WelcomeFarewellFormLabels>
}

const DEFAULT_WELCOME_PLACEHOLDERS = ['{empresa}', '{telefone}', '{email}', '{endereco}', '{maps}'] as const
const DEFAULT_FAREWELL_PLACEHOLDERS = ['{empresa}', '{telefone}', '{email}'] as const

// Paridade com financiamento-imobiliario-bot/apps/web/src/pages/MessagesPage.tsx (aba
// "bot", seção "Boas-vindas e Encerramento") — usa o mesmo WhatsAppMessageEditor do
// pacote (T6.5), puramente apresentacional.
export function WelcomeFarewellForm({
  welcomeMessage,
  onWelcomeMessageChange,
  farewellMessage,
  onFarewellMessageChange,
  onSave,
  saving = false,
  saveSuccess = false,
  welcomePlaceholders = DEFAULT_WELCOME_PLACEHOLDERS,
  farewellPlaceholders = DEFAULT_FAREWELL_PLACEHOLDERS,
  labels: labelsOverride,
}: WelcomeFarewellFormProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsOverride }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{labels.sectionTitle}</h2>
      </div>

      <form onSubmit={onSave} className="p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
            <Mail size={13} className="text-blue-600 dark:text-blue-400" />
            {labels.welcomeMessage}
          </label>
          <WhatsAppMessageEditor
            value={welcomeMessage}
            onChange={onWelcomeMessageChange}
            placeholder={labels.welcomeMessagePlaceholder}
            placeholders={welcomePlaceholders}
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{labels.welcomeMessageHint}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
            <LogOut size={13} className="text-blue-600 dark:text-blue-400" />
            {labels.farewellMessage}
          </label>
          <WhatsAppMessageEditor
            value={farewellMessage}
            onChange={onFarewellMessageChange}
            placeholder={labels.farewellMessagePlaceholder}
            placeholders={farewellPlaceholders}
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{labels.farewellMessageHint}</p>
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
            disabled={saving}
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
