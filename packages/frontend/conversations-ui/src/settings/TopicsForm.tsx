import type { FormEvent } from 'react'
import { Megaphone, Save } from 'lucide-react'

export interface TopicItem {
  key: string
  label: string
  enabled: boolean
  message: string
}

export interface TopicsFormLabels {
  sectionTitle: string
  sectionDescription: string
  messagePlaceholder: string
  saveButton: string
  saveSuccess: string
}

const DEFAULT_LABELS: TopicsFormLabels = {
  sectionTitle: 'Tópicos intermediários',
  sectionDescription: 'Mensagens automáticas para assuntos específicos, disparadas quando o cliente demonstra interesse.',
  messagePlaceholder: 'Digite a mensagem automática para este tópico...',
  saveButton: 'Salvar tópicos',
  saveSuccess: 'Tópicos salvos com sucesso.',
}

export interface TopicsFormProps {
  topics: TopicItem[]
  onToggle: (key: string) => void
  onMessageChange: (key: string, message: string) => void
  onSave: (event: FormEvent) => void
  saving?: boolean
  saveSuccess?: boolean
  labels?: Partial<TopicsFormLabels>
}

// Paridade com financiamento-imobiliario-bot/apps/web/src/pages/MessagesPage.tsx (aba
// "bot", seção "Tópicos intermediários") — generalizado para uma lista de tópicos
// (o bot hardcoda 'consorcio'/'promocoes'; aqui o host declara os próprios).
export function TopicsForm({
  topics,
  onToggle,
  onMessageChange,
  onSave,
  saving = false,
  saveSuccess = false,
  labels: labelsOverride,
}: TopicsFormProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsOverride }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Megaphone size={16} className="text-orange-600 dark:text-orange-400" />
          {labels.sectionTitle}
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{labels.sectionDescription}</p>
      </div>

      <form onSubmit={onSave} className="p-6 space-y-6">
        {topics.map((topic) => (
          <div key={topic.key} className="space-y-2">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{topic.label}</p>
              </div>
              <button
                data-cv-tooltip={topic.label} aria-label={topic.label}
                type="button"
                onClick={() => onToggle(topic.key)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  topic.enabled ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
                }`}
                role="switch"
                aria-checked={topic.enabled}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    topic.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <textarea
              value={topic.message}
              onChange={(e) => onMessageChange(topic.key, e.target.value)}
              placeholder={labels.messagePlaceholder}
              maxLength={300}
              rows={2}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}

        <div className="flex items-center gap-3">
          <button
            data-cv-tooltip={labels.saveButton} aria-label={labels.saveButton}
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={14} />
            {labels.saveButton}
          </button>
          {saveSuccess && <span className="text-sm text-green-600 dark:text-green-400">{labels.saveSuccess}</span>}
        </div>
      </form>
    </section>
  )
}
