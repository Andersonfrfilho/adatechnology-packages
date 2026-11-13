import { type NodeProps } from '@xyflow/react'

export type FlowGroupFrameData = {
  label: string
}

// Moldura decorativa atrás de uma cadeia de perguntas lineares que alimenta um nó de ação
// (ex.: "renda → valor do imóvel → prazo" antes de uma ação) — puramente visual, não editável,
// computada da topologia real do grafo (findCollectionChains), não é um dado novo.
export function FlowGroupFrame({ data }: NodeProps) {
  const { label } = data as unknown as FlowGroupFrameData
  return (
    <div className="relative w-full h-full rounded-xl border-2 border-dashed border-orange-300/70 dark:border-orange-700/50 bg-orange-50/40 dark:bg-orange-950/10">
      <span className="absolute -top-6 left-1 text-[11px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide whitespace-nowrap">
        {label}
      </span>
    </div>
  )
}

export const flowGroupFrameNodeTypes = { flowGroupFrame: FlowGroupFrame }
