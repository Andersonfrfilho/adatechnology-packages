import { useMemo } from 'react'
import { ReactFlow, Background, Controls, MarkerType, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useIsDarkTheme } from '../useDarkMode'
import { flowMapNodeTypes, type FlowMapNodeData } from './FlowMapNode'
import { computeFlowMapLayout, crossFlowTargetsOf, type FlowGraphData } from './flowGraph'
import { DEFAULT_FLOW_EDITOR_LABELS, type FlowEditorLabels } from './labels'

const MAP_NODE_TYPES = { ...flowMapNodeTypes }

const EDGE_COLOR = '#06b6d4'
const BACKGROUND_COLOR_LIGHT = '#cbd5e1'
const BACKGROUND_COLOR_DARK = '#334155'

export interface FlowMapCanvasProps {
  graphs: Record<string, FlowGraphData>
  rootKey: string
  onOpenFlow: (key: string) => void
  labels?: Partial<FlowEditorLabels>
}

// Paridade com financiamento-imobiliario-bot/apps/web/src/components/flows/FlowMapCanvas.tsx —
// visão hierárquica onde cada fluxo é um único nó, ligado por saltos "flow:<key>".
export function FlowMapCanvas({ graphs, rootKey, onOpenFlow, labels: labelsOverride }: FlowMapCanvasProps) {
  const labels = { ...DEFAULT_FLOW_EDITOR_LABELS, ...labelsOverride }
  const isDark = useIsDarkTheme()
  const positions = useMemo(() => computeFlowMapLayout(graphs, rootKey), [graphs, rootKey])

  const nodes = useMemo<Node[]>(
    () =>
      Object.values(graphs).map(
        (g): Node => ({
          id: g.key,
          type: 'flowMapNode',
          position: positions[g.key] ?? { x: 0, y: 0 },
          data: {
            label: g.label,
            nodeCount: Object.keys(g.nodes).length,
            isRoot: g.key === rootKey,
            labels,
            onOpen: () => onOpenFlow(g.key),
          } satisfies FlowMapNodeData,
        }),
      ),
    [graphs, positions, rootKey, onOpenFlow, labels],
  )

  const edges = useMemo<Edge[]>(() => {
    const list: Edge[] = []
    for (const g of Object.values(graphs)) {
      for (const targetKey of crossFlowTargetsOf(g)) {
        if (!graphs[targetKey]) continue
        list.push({
          id: `${g.key}->${targetKey}`,
          source: g.key,
          target: targetKey,
          type: 'default',
          style: { stroke: EDGE_COLOR, strokeWidth: 1.75 },
          markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR, width: 18, height: 18 },
        })
      }
    }
    return list
  }, [graphs])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={MAP_NODE_TYPES}
      fitView
      proOptions={{ hideAttribution: true }}
      colorMode={isDark ? 'dark' : 'light'}
    >
      <Background color={isDark ? BACKGROUND_COLOR_DARK : BACKGROUND_COLOR_LIGHT} />
      <Controls />
    </ReactFlow>
  )
}
