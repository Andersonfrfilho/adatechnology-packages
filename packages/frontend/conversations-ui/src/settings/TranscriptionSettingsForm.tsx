import type { FormEvent } from 'react'
import { AudioLines, Save } from 'lucide-react'
import type { TranscriptionMode } from '../types'

export interface TranscriptionSettingsFormLabels {
  sectionTitle: string
  enabled: string
  enabledHint: string
  modeTitle: string
  modeAuto: string
  modeAutoHint: string
  modeOnDemand: string
  modeOnDemandHint: string
  unavailable: string
  save: string
  saving: string
  saveSuccess: string
}

const DEFAULT_LABELS: TranscriptionSettingsFormLabels = {
  sectionTitle: 'Transcrição de áudio',
  enabled: 'Transcrever notas de voz',
  enabledHint: 'Converte o áudio do cliente em texto, que o atendente lê e copia direto da conversa.',
  modeTitle: 'Quando transcrever',
  modeAuto: 'Automaticamente',
  modeAutoHint: 'Toda nota de voz recebida é transcrita na hora. Mais cômodo, consome mais cota.',
  modeOnDemand: 'Quando o atendente pedir',
  modeOnDemandHint: 'Transcreve só ao clicar no botão da conversa. Consome cota apenas com áudio que alguém vai ler.',
  unavailable: 'Transcrição não está disponível neste ambiente — fale com quem administra a instalação.',
  save: 'Salvar',
  saving: 'Salvando...',
  saveSuccess: 'Configuração de transcrição salva.',
}

export interface TranscriptionSettingsFormProps {
  enabled: boolean
  onEnabledChange: (value: boolean) => void
  mode: TranscriptionMode
  onModeChange: (value: TranscriptionMode) => void
  onSave: (event: FormEvent) => void
  /**
   * A capacidade existe no servidor (engine e credencial configurados)?
   *
   * Distinto de `enabled`: isto é "o ambiente consegue", aquilo é "esta empresa quer". Sem a
   * distinção, um lojista ligaria o interruptor num ambiente sem engine e concluiria que o produto
   * está quebrado — o texto nunca apareceria e nada explicaria por quê.
   */
  isAvailable?: boolean
  saving?: boolean
  saveSuccess?: boolean
  labels?: Partial<TranscriptionSettingsFormLabels>
}

/**
 * Interruptor de transcrição por empresa, para a tela de configurações.
 *
 * Puramente apresentacional, como os outros forms daqui: quem persiste é o host. O pacote não sabe a
 * rota, e a política vive nas configurações do módulo (`settings.transcriptionEnabled`), não em
 * variável de ambiente — mudar de ideia sobre transcrever não deveria exigir deploy.
 */
export function TranscriptionSettingsForm({
  enabled,
  onEnabledChange,
  mode,
  onModeChange,
  onSave,
  isAvailable = true,
  saving = false,
  saveSuccess = false,
  labels: labelsOverride,
}: TranscriptionSettingsFormProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsOverride }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          <AudioLines size={14} className="text-blue-600 dark:text-blue-400" />
          {labels.sectionTitle}
        </h2>
      </div>

      <form onSubmit={onSave} className="p-6 space-y-5">
        {!isAvailable && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            {labels.unavailable}
          </div>
        )}

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
            disabled={!isAvailable}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
          />
          <span>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">{labels.enabled}</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">{labels.enabledHint}</span>
          </span>
        </label>

        {/* O modo só aparece quando ligado: escolher "quando transcrever" sem transcrever nada é uma
            pergunta sem consequência, e ler as duas opções gasta atenção do operador à toa. */}
        {enabled && (
          <fieldset disabled={!isAvailable} className="space-y-2.5">
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{labels.modeTitle}</legend>

            <ModeOption
              value="onDemand"
              current={mode}
              onSelect={onModeChange}
              title={labels.modeOnDemand}
              hint={labels.modeOnDemandHint}
            />
            <ModeOption
              value="auto"
              current={mode}
              onSelect={onModeChange}
              title={labels.modeAuto}
              hint={labels.modeAutoHint}
            />
          </fieldset>
        )}

        {saveSuccess && (
          <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 text-sm text-green-700 dark:text-green-400">
            {labels.saveSuccess}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !isAvailable}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {saving ? labels.saving : labels.save}
          </button>
        </div>
      </form>
    </section>
  )
}

function ModeOption({
  value,
  current,
  onSelect,
  title,
  hint,
}: {
  value: TranscriptionMode
  current: TranscriptionMode
  onSelect: (value: TranscriptionMode) => void
  title: string
  hint: string
}) {
  const isSelected = current === value

  return (
    <label
      className={`flex items-start gap-3 cursor-pointer rounded-xl border px-4 py-3 transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30'
          : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
      }`}
    >
      <input
        type="radio"
        name="transcription-mode"
        value={value}
        checked={isSelected}
        onChange={() => onSelect(value)}
        className="mt-0.5 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span>
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">{hint}</span>
      </span>
    </label>
  )
}
