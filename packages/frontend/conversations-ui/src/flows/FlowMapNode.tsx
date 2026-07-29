import { Handle, Position, type NodeProps } from '@xyflow/react'
import { GitBranch, Maximize2 } from 'lucide-react'
import { DEFAULT_FLOW_EDITOR_LABELS, type FlowEditorLabels } from './labels'

export type FlowMapNodeData = {
  label: string
  nodeCount: number
  isRoot: boolean
  labels: FlowEditorLabels
  onOpen: () => void
}

// Nó do MAPA de fluxos (visão hierárquica): representa um fluxo inteiro como uma única caixa,
// sem entrar nos nós internos — complementar à fusão editável, que mostra os nós de verdade.
export function FlowMapNode({ data }: NodeProps) {
  const { label, nodeCount, isRoot, labels = DEFAULT_FLOW_EDITOR_LABELS, onOpen } = data as unknown as FlowMapNodeData

  return (
    <div className="relative rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 w-56 shadow-sm">
      <Handle type="target" position={Position.Top} className="!bg-gray-400 dark:!bg-gray-500" />
      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
        <GitBranch size={14} />
        <span className="text-sm font-semibold truncate">{label}</span>
        {isRoot && (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" title={labels.startNodeTooltip} />
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{labels.flowMap.nodeCount(nodeCount)}</p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
      >
        <Maximize2 size={11} /> {labels.flowMap.openFlow}
      </button>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 dark:!bg-gray-500" />
    </div>
  )
}

export const flowMapNodeTypes = { flowMapNode: FlowMapNode }
