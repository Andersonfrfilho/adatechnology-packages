import { List } from 'lucide-react'
import { parseWhatsAppFormatting } from '../lib/whatsapp-formatting'
import { DEFAULT_FLOW_EDITOR_LABELS, type FlowEditorLabels } from './labels'
import { rendersAsButtons, WHATSAPP_LIMITS } from './flowGraph'

export interface FlowWhatsAppPreviewProps {
  body: string
  options?: [string, string][]
  labels?: FlowEditorLabels['nodePanel']
}

// Espelha como o WhatsApp REALMENTE renderiza a mensagem do nó: bolha de texto e, quando há
// opções, botões (≤3) ou lista (4+) — para o editor mostrar exatamente o que o cliente verá.
// Consome a mesma bolha/formatação do pacote (parseWhatsAppFormatting, T6.5) — T7.3 elimina a
// duplicação de estilo que existia entre este preview e o MessageBubble do bot.
export function FlowWhatsAppPreview({ body, options, labels = DEFAULT_FLOW_EDITOR_LABELS.nodePanel }: FlowWhatsAppPreviewProps) {
  if (!body && (!options || options.length === 0)) {
    return <p className="text-xs text-gray-400 dark:text-gray-500 italic px-1">{labels.previewPlaceholder}</p>
  }

  const usesButtons = rendersAsButtons(options)
  const hasOptions = (options?.length ?? 0) > 0

  return (
    <div className="rounded-xl bg-[#e5ddd5] dark:bg-gray-900 p-3 space-y-1.5">
      <div className="max-w-[85%]">
        <div className="rounded-lg rounded-tl-none bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm whitespace-pre-wrap break-words">
          {body ? parseWhatsAppFormatting(body) : <span className="italic text-gray-400">{labels.previewEmptyBody}</span>}
          {hasOptions && !usesButtons && (
            <div className="mt-2 -mx-3 -mb-2 border-t border-gray-100 dark:border-gray-600">
              <div className="flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-cyan-600 dark:text-cyan-400">
                <List size={15} /> {labels.previewListButton}
              </div>
            </div>
          )}
        </div>

        {hasOptions && usesButtons && (
          <div className="mt-1 space-y-1">
            {options!.map(([id, label]) => (
              <div key={id} className="rounded-lg bg-white dark:bg-gray-700 py-1.5 text-center text-sm font-medium text-cyan-600 dark:text-cyan-400 shadow-sm">
                {label || <span className="italic text-gray-400">{labels.previewEmptyOption}</span>}
              </div>
            ))}
          </div>
        )}

        {hasOptions && !usesButtons && (
          <div className="mt-1.5 rounded-lg bg-white dark:bg-gray-700 shadow-sm divide-y divide-gray-100 dark:divide-gray-600 overflow-hidden">
            {options!.slice(0, WHATSAPP_LIMITS.MAX_LIST_ROWS).map(([id, label]) => (
              <div key={id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-100">
                <span className="h-3.5 w-3.5 rounded-full border border-gray-300 dark:border-gray-500 shrink-0" />
                {label || <span className="italic text-gray-400">{labels.previewEmptyOption}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {hasOptions && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 px-1">
          {usesButtons ? labels.previewModeButtons : labels.previewModeList}
        </p>
      )}
    </div>
  )
}
