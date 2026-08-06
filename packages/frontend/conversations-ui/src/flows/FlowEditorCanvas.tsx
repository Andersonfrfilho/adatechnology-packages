/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O canvas de edição: traduz o modelo neutro (`flowCanvasModel`) nos nós e arestas do
 * `@xyflow/react`, e devolve gestos (arrastar, ligar, selecionar) para o hook.
 *
 * A tradução mora aqui, e não no modelo, porque cor e traço são justamente a parte que ninguém
 * quebra sem ver — enquanto um destino errado é invisível. O modelo decide para onde a aresta vai; o
 * componente decide como ela parece.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from '@xyflow/react'

import { useIsDarkTheme } from '../useDarkMode'
import {
  NODE_CARD_WIDTH,
  computeAutoLayout,
  crossFlowKey,
  findCollectionChains,
  isCrossFlowTarget,
  targetsOf,
} from './flowGraph'
import { flowNodeTypes, nodeLabel } from './FlowNodeCard'
import type { FlowNodeCardData } from './FlowNodeCard'
import { flowGroupFrameNodeTypes } from './FlowGroupFrame'
import type { FlowGroupFrameData } from './FlowGroupFrame'
import { flowGroupHeaderNodeTypes } from './FlowGroupHeader'
import type { FlowGroupHeaderData } from './FlowGroupHeader'
import { flowPortalNodeTypes } from './FlowPortalNode'
import type { FlowPortalNodeData } from './FlowPortalNode'
import { namespaceNodeId, parseNamespacedId } from './flowEditorOps'
import {
  GROUP_HEADER_NODE_ID,
  buildFlowEdges,
  chainFrameBounds,
  chainFrameNodeId,
  computeMergedLayout,
  countLiveByNode,
  detachedNodeIds,
  portalNodeId,
  type FlowEdgeSpec,
  type FlowNodePosition,
} from './flowCanvasModel'
import type { FlowEditorLabels } from './labels'
import type { FlowsEditor } from './useFlowsEditor'

const NODE_TYPES = {
  ...flowNodeTypes,
  ...flowPortalNodeTypes,
  ...flowGroupHeaderNodeTypes,
  ...flowGroupFrameNodeTypes,
}

const CHAIN_FRAME_PADDING = 36
const NEW_FLOW_HORIZONTAL_GAP = 320
const PORTAL_VERTICAL_GAP = 70
const GROUP_HEADER_OFFSET_Y = 60

const EDGE_COLOR = {
  linear: '#94a3b8',
  branch: '#a855f7',
  fallback: '#cbd5e1',
  live: '#3b82f6',
  crossFlow: '#06b6d4',
} as const

function edgeStyle(spec: FlowEdgeSpec): Edge {
  const color = spec.crossFlow
    ? EDGE_COLOR.crossFlow
    : spec.live
      ? EDGE_COLOR.live
      : EDGE_COLOR[spec.kind]
  const dash = spec.crossFlow ? '3 3' : spec.kind === 'fallback' ? '5 4' : undefined

  return {
    id: spec.id,
    source: spec.source,
    target: spec.target,
    ...(spec.sourceHandle === undefined ? {} : { sourceHandle: spec.sourceHandle }),
    type: 'bezier',
    animated: spec.live,
    style: {
      stroke: color,
      strokeWidth: spec.live ? 2.5 : spec.kind === 'branch' ? 1.75 : 1.5,
      ...(dash === undefined ? {} : { strokeDasharray: dash }),
    },
    markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
  }
}

export type FlowEditorCanvasProps = {
  readonly editor: FlowsEditor
  readonly labels: FlowEditorLabels
}

export function FlowEditorCanvas({ editor, labels }: FlowEditorCanvasProps) {
  const isDark = useIsDarkTheme()
  const [canvasNodes, setCanvasNodes] = useState<Node[]>([])
  const [instance, setInstance] = useState<ReactFlowInstance | undefined>(undefined)

  const { openFlowKeys, workingGraphs, graphs, primaryFlowKey, livePositions, issuesByFlow, editingRef } = editor

  const isMerged = openFlowKeys.length > 1
  const mergedPositions = useMemo(
    () => (isMerged ? computeMergedLayout({ openKeys: openFlowKeys, graphs: workingGraphs, primaryFlowKey }) : undefined),
    [isMerged, openFlowKeys, workingGraphs, primaryFlowKey],
  )

  const derivedNodes = useMemo<Node[]>(() => {
    const result: Node[] = []

    for (const flowKey of openFlowKeys) {
      const graph = workingGraphs[flowKey]
      if (!graph) continue

      const autoPositions = mergedPositions ? undefined : computeAutoLayout(graph)
      const liveCounts = countLiveByNode(flowKey, livePositions)
      const detached = detachedNodeIds(graph)
      const flowIssues = issuesByFlow[flowKey] ?? []

      function positionOf(nodeId: string): FlowNodePosition {
        const namespaced = namespaceNodeId(flowKey, nodeId)
        // A posição já desenhada manda: sem isso o canvas inteiro salta a cada fio ligado.
        const remembered = editor.renderedPositions.current.get(namespaced)
        if (remembered) return remembered
        if (mergedPositions) return mergedPositions.get(namespaced) ?? { x: 0, y: 0 }
        return graph!.nodes[nodeId]?.position ?? autoPositions?.[nodeId] ?? { x: 0, y: 0 }
      }

      for (const node of Object.values(graph.nodes)) {
        const position = positionOf(node.id)

        result.push({
          id: namespaceNodeId(flowKey, node.id),
          type: 'flowNode',
          position,
          draggable: true,
          data: {
            node,
            liveCount: liveCounts[node.id] ?? 0,
            isStart: node.id === graph.startNodeId,
            isSelected: editingRef?.flowKey === flowKey && editingRef?.nodeId === node.id,
            isDetached: detached.has(node.id),
            issues: flowIssues,
            labels,
            onSelect: (nodeId: string) => editor.selectNode({ flowKey, nodeId }),
          } satisfies FlowNodeCardData,
        })

        // Portal só para salto cujo fluxo alvo ainda NÃO está no canvas. Abrir um fluxo já traz o
        // fecho transitivo, então isto é rede de segurança para fluxo criado depois da fusão.
        const pendingTargets = [
          ...new Set(
            targetsOf(node)
              .map((each) => each.target)
              .filter((target) => isCrossFlowTarget(target) && !openFlowKeys.includes(crossFlowKey(target))),
          ),
        ]

        pendingTargets.forEach((target, index) => {
          const targetKey = crossFlowKey(target)
          result.push({
            id: namespaceNodeId(flowKey, portalNodeId(node.id, target)),
            type: 'flowPortal',
            draggable: false,
            selectable: false,
            position: {
              x: position.x + NEW_FLOW_HORIZONTAL_GAP,
              y: position.y + index * PORTAL_VERTICAL_GAP,
            },
            data: {
              label: graphs?.[targetKey]?.label ?? targetKey,
              labels,
              onNavigate: () => editor.mergeFlow(targetKey),
            } satisfies FlowPortalNodeData,
          })
        })
      }

      // Moldura por trás de cada cadeia de perguntas que alimenta uma ação — derivada da topologia,
      // sem ninguém marcar à mão quais perguntas "pertencem" ao cálculo.
      for (const chain of findCollectionChains(graph)) {
        const chainNodeIds = [...chain.nodeIds, chain.actionNodeId]
        const bounds = chainFrameBounds({
          nodeIds: chainNodeIds,
          graph,
          positionOf,
          padding: CHAIN_FRAME_PADDING,
        })

        result.push({
          id: namespaceNodeId(flowKey, chainFrameNodeId(chain.actionNodeId)),
          type: 'flowGroupFrame',
          draggable: false,
          selectable: false,
          zIndex: -1,
          position: { x: bounds.x, y: bounds.y },
          style: { width: bounds.width, height: bounds.height },
          data: {
            label: labels.collectionChain.feeds(nodeLabel(graph.nodes[chain.actionNodeId], labels)),
          } satisfies FlowGroupFrameData,
        })
      }

      // Cabeçalho flutuante só nos fluxos mesclados: o primário já tem os controles na barra de cima.
      if (flowKey !== primaryFlowKey) {
        const start = positionOf(graph.startNodeId)
        result.push({
          id: namespaceNodeId(flowKey, GROUP_HEADER_NODE_ID),
          type: 'flowGroupHeader',
          draggable: false,
          selectable: false,
          position: { x: start.x, y: start.y - GROUP_HEADER_OFFSET_Y },
          data: {
            label: graph.label,
            labels,
            onFocus: () => editor.focusFlow(flowKey),
            onClose: () => editor.closeFlow(flowKey),
          } satisfies FlowGroupHeaderData,
        })
      }
    }

    return result
  }, [
    openFlowKeys,
    workingGraphs,
    mergedPositions,
    livePositions,
    issuesByFlow,
    primaryFlowKey,
    editingRef,
    graphs,
    labels,
    editor,
  ])

  const edges = useMemo(
    () => buildFlowEdges({ openKeys: openFlowKeys, graphs: workingGraphs, livePositions }).map(edgeStyle),
    [openFlowKeys, workingGraphs, livePositions],
  )

  useEffect(() => {
    setCanvasNodes(derivedNodes)
    for (const node of derivedNodes) {
      if (node.type === 'flowNode') editor.renderedPositions.current.set(node.id, node.position)
    }
  }, [derivedNodes, editor.renderedPositions])

  // Nó recém-criado nasce órfão, e órfão vai para a coluna extra — que num canvas mesclado cai fora
  // da área visível. Espera ele existir e leva a viewport até lá.
  useEffect(() => {
    const pending = editor.pendingFocusNodeId
    if (!pending || !instance) return
    const target = canvasNodes.find((each) => each.id === pending)
    if (!target) return
    instance.setCenter(target.position.x + NODE_CARD_WIDTH / 2, target.position.y, { zoom: 1, duration: 400 })
    editor.clearPendingFocus()
  }, [editor, instance, canvasNodes])

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setCanvasNodes((current) => applyNodeChanges(changes, current))
  }, [])

  const handleNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      const { flowKey, nodeId } = parseNamespacedId(node.id)
      editor.moveNode({ flowKey, nodeId }, node.position)
    },
    [editor],
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      editor.connect({
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
      })
    },
    [editor],
  )

  return (
    <ReactFlow
      nodes={canvasNodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      onNodesChange={handleNodesChange}
      onNodeDragStop={handleNodeDragStop}
      onConnect={handleConnect}
      onInit={setInstance}
      fitView
      proOptions={{ hideAttribution: true }}
      colorMode={isDark ? 'dark' : 'light'}
    >
      <Background color={isDark ? '#374151' : '#e5e7eb'} />
      <Controls />
      <MiniMap pannable zoomable className="cv-flows-minimap" />
    </ReactFlow>
  )
}
