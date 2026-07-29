import { type NodeProps } from '@xyflow/react'
import { Maximize2, X } from 'lucide-react'
import { DEFAULT_FLOW_EDITOR_LABELS, type FlowEditorLabels } from './labels'

export type FlowGroupHeaderData = {
  label: string
  labels?: FlowEditorLabels
  onFocus: () => void
  onClose: () => void
}

// Rótulo flutuante acima do primeiro nó de um fluxo mesclado no canvas (fusão editável) —
// não é um nó de verdade do grafo, só identifica de qual fluxo é aquele agrupado de cards e
// oferece as duas ações que o isolam de volta: focar nele sozinho, ou fechá-lo sem editar.
export function FlowGroupHeader({ data }: NodeProps) {
  const { label, labels = DEFAULT_FLOW_EDITOR_LABELS, onFocus, onClose } = data as unknown as FlowGroupHeaderData

  return (
    <div className="flex items-center gap-2 rounded-full border border-cyan-300 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-950/50 px-3 py-1 text-xs font-medium text-cyan-800 dark:text-cyan-200 shadow-sm whitespace-nowrap">
      <span>{label}</span>
      <button
        type="button"
        onClick={onFocus}
        title={labels.flowGroup.focus}
        className="hover:text-blue-600 dark:hover:text-blue-400"
      >
        <Maximize2 size={12} />
      </button>
      <button
        type="button"
        onClick={onClose}
        title={labels.flowGroup.close}
        className="hover:text-red-600 dark:hover:text-red-400"
      >
        <X size={12} />
      </button>
    </div>
  )
}

export const flowGroupHeaderNodeTypes = { flowGroupHeader: FlowGroupHeader }
