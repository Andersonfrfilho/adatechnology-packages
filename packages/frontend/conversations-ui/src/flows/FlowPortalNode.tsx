import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ArrowUpRight } from 'lucide-react'
import { DEFAULT_FLOW_EDITOR_LABELS, type FlowEditorLabels } from './labels'

export type FlowPortalNodeData = {
  label: string
  labels?: FlowEditorLabels
  onNavigate: () => void
}

// Pseudo-nó: representa visualmente um salto "flow:<key>" para outro fluxo, que não tem um nó
// real para desenhar a ligação dentro deste grafo. Clicar nele navega o editor pro fluxo alvo.
export function FlowPortalNode({ data }: NodeProps) {
  const { label, labels = DEFAULT_FLOW_EDITOR_LABELS, onNavigate } = data as unknown as FlowPortalNodeData

  return (
    <button
      type="button"
      data-cv-tooltip={labels.crossFlowPortal.tooltip} aria-label={labels.crossFlowPortal.tooltip}
      onClick={onNavigate}
      className="relative flex items-center gap-1.5 rounded-full border-2 border-dashed border-cyan-400 dark:border-cyan-600 bg-cyan-50 dark:bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-950/70 transition-colors cursor-pointer"
    >
      <Handle type="target" position={Position.Top} id="target" className="!bg-cyan-400 dark:!bg-cyan-600" />
      <ArrowUpRight size={12} strokeWidth={2.5} />
      {labels.crossFlowPortal.goesTo(label)}
    </button>
  )
}

export const flowPortalNodeTypes = { flowPortal: FlowPortalNode }
