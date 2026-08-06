/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Estado do editor de fluxos: rascunho local, fluxos abertos, seleção, validação e publicação.
 *
 * É a parte que carrega o risco — o rascunho de quem está editando vive aqui, e perdê-lo não dá
 * erro nenhum. Fica separada da casca de propósito (ADR 0002): a casca é a parte visível, mas é o
 * estado que faz alguém perder meia hora de trabalho.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FlowGraphData, FlowNodeData } from '@adatechnology/meta-whatsapp-contracts'

import { useAsyncResource } from '../hooks/useAsyncResource'
import type { FlowEditorLabels } from './labels'
import { type GraphIssue, computeAutoLayout, validateGraph } from './flowGraph'
import {
  applyConnection,
  isGraphDirty,
  mergedFlowKeysFrom,
  namespaceNodeId,
  removeNodeAndCleanRefs,
  resolveConnection,
  type ConnectionRequest,
} from './flowEditorOps'
import { type FlowLivePosition, type FlowNodePosition, computeMergedLayout, newNodeFromSpec } from './flowCanvasModel'
import type { NewNodeSpec } from './FlowPalette'

const LIVE_POSITIONS_POLL_MS = 5000
const SAVE_SUCCESS_LINGER_MS = 3000

/** Só o que o editor precisa do servidor. Nenhuma rota assumida — cada produto tem as suas. */
export type FlowsWorkspaceApi = {
  getGraphs: () => Promise<Record<string, FlowGraphData>>
  saveGraph: (key: string, graph: FlowGraphData) => Promise<void>
  createFlow: (input: {
    key: string
    label: string
    showInMenu: boolean
    menuOptionLabel?: string | undefined
  }) => Promise<void>
  deleteFlow: (key: string) => Promise<void>
  /** Ausente, o canvas simplesmente não mostra conversas ao vivo — e não fica pesquisando nada. */
  getLivePositions?: (() => Promise<readonly FlowLivePosition[]>) | undefined
}

export type FlowNodeRef = { readonly flowKey: string; readonly nodeId: string }

export type SaveState = 'idle' | 'saving' | 'success' | 'error'

type UseFlowsEditorParams = {
  readonly api: FlowsWorkspaceApi
  readonly rootFlowKey: string
  readonly labels: FlowEditorLabels
}

export function useFlowsEditor(params: UseFlowsEditorParams) {
  const { api, rootFlowKey, labels } = params

  // A `api` entra por ref, e as dependências de busca ficam vazias de propósito: um produto que
  // monte o objeto inline (`api={{ ... }}`) criaria uma referência nova a cada render, e com ela nas
  // dependências o editor buscaria em laço — martelando o servidor sem nada na tela mudar.
  const apiRef = useRef(api)
  apiRef.current = api

  const graphsResource = useAsyncResource(() => apiRef.current.getGraphs(), [])
  const graphs = graphsResource.data

  const [livePositions, setLivePositions] = useState<readonly FlowLivePosition[] | undefined>(undefined)
  const [openFlowKeys, setOpenFlowKeys] = useState<readonly string[]>([rootFlowKey])
  const [hasAutoMerged, setHasAutoMerged] = useState(false)
  const [workingGraphs, setWorkingGraphs] = useState<Record<string, FlowGraphData>>({})
  const [editingRef, setEditingRef] = useState<FlowNodeRef | undefined>(undefined)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | undefined>(undefined)
  const [pendingFocusNodeId, setPendingFocusNodeId] = useState<string | undefined>(undefined)

  /**
   * Última posição em que cada card foi desenhado, e ela manda sobre o layout calculado.
   *
   * O layout mesclado é recalculado a cada mudança de topologia: ligar ou desligar um fio mexia no
   * rank de todo mundo e o canvas inteiro saltava — o card que perdeu a ligação ia para a faixa dos
   * órfãos e os vizinhos trocavam de coluna, o que se lê como "o card sumiu". Aqui o layout é só a
   * semente de quem ainda não tem lugar.
   */
  const renderedPositions = useRef(new Map<string, FlowNodePosition>())

  useEffect(() => {
    const fetchLive = apiRef.current.getLivePositions
    if (!fetchLive) return

    let active = true
    const load = () => {
      fetchLive().then(
        (result) => {
          if (active) setLivePositions(result)
        },
        // Posição ao vivo é enfeite: falhar em silêncio é melhor que encher a tela de erro por
        // causa de um número que some.
        () => undefined,
      )
    }

    load()
    const timer = setInterval(load, LIVE_POSITIONS_POLL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  // "Publicado" é confirmação, não estado: sem apagar, a etiqueta fica na barra para sempre e deixa
  // de significar que ALGO acabou de ser publicado.
  useEffect(() => {
    if (saveState !== 'success') return
    const timer = setTimeout(() => setSaveState('idle'), SAVE_SUCCESS_LINGER_MS)
    return () => clearTimeout(timer)
  }, [saveState])

  // Na primeira carga abre junto todo o fecho transitivo a partir da raiz: "o fluxo completo"
  // aparece de cara, sem clicar em cada portal. Só uma vez — depois o controle é de quem edita.
  useEffect(() => {
    if (!graphs || hasAutoMerged) return
    setOpenFlowKeys(mergedFlowKeysFrom(rootFlowKey, graphs))
    setHasAutoMerged(true)
  }, [graphs, hasAutoMerged, rootFlowKey])

  // Semeia o rascunho de fluxo recém-aberto e NUNCA sobrescreve um que já tem rascunho: uma busca
  // de fundo apagaria edição não publicada.
  useEffect(() => {
    if (!graphs) return
    setWorkingGraphs((previous) => {
      let changed = false
      const next = { ...previous }
      for (const key of openFlowKeys) {
        if (!next[key] && graphs[key]) {
          next[key] = graphs[key]
          changed = true
        }
      }
      return changed ? next : previous
    })
  }, [graphs, openFlowKeys])

  const primaryFlowKey = openFlowKeys[0] ?? rootFlowKey
  const primaryGraph = workingGraphs[primaryFlowKey]

  const isFlowDirty = useCallback(
    (key: string) => isGraphDirty(workingGraphs[key], graphs?.[key]),
    [workingGraphs, graphs],
  )

  const dirtyKeys = useMemo(() => openFlowKeys.filter(isFlowDirty), [openFlowKeys, isFlowDirty])

  const issuesByFlow = useMemo<Record<string, GraphIssue[]>>(() => {
    const result: Record<string, GraphIssue[]> = {}
    for (const key of openFlowKeys) {
      const graph = workingGraphs[key]
      if (graph) result[key] = validateGraph(graph, labels.validation)
    }
    return result
  }, [openFlowKeys, workingGraphs, labels.validation])

  const allIssues = useMemo(() => Object.values(issuesByFlow).flat(), [issuesByFlow])
  const errorCount = allIssues.filter((each) => each.severity === 'error').length
  const warningCount = allIssues.filter((each) => each.severity === 'warning').length

  const updateFlow = useCallback((flowKey: string, updater: (graph: FlowGraphData) => FlowGraphData) => {
    setWorkingGraphs((previous) => {
      const graph = previous[flowKey]
      if (!graph) return previous
      return { ...previous, [flowKey]: updater(graph) }
    })
  }, [])

  const confirmDiscardIfDirty = useCallback(
    (keys: readonly string[]) => !keys.some(isFlowDirty) || window.confirm(labels.workspace.unsavedChangesConfirm),
    [isFlowDirty, labels.workspace.unsavedChangesConfirm],
  )

  /** Trocar o fluxo primário re-abre o fecho transitivo DELE — não isola o fluxo sozinho. */
  const focusFlow = useCallback(
    (key: string) => {
      if (!confirmDiscardIfDirty(openFlowKeys.filter((each) => each !== key))) return
      setOpenFlowKeys(graphs ? mergedFlowKeysFrom(key, graphs) : [key])
      setEditingRef((current) => (current && current.flowKey !== key ? undefined : current))
    },
    [confirmDiscardIfDirty, openFlowKeys, graphs],
  )

  const closeFlow = useCallback(
    (key: string) => {
      if (!confirmDiscardIfDirty([key])) return
      setOpenFlowKeys((previous) => previous.filter((each) => each !== key))
      setWorkingGraphs((previous) => Object.fromEntries(Object.entries(previous).filter(([each]) => each !== key)))
      setEditingRef((current) => (current?.flowKey === key ? undefined : current))
    },
    [confirmDiscardIfDirty],
  )

  /** Fusão editável: traz os nós de verdade do fluxo alvo para o mesmo canvas, no lugar do portal. */
  const mergeFlow = useCallback((key: string) => {
    setOpenFlowKeys((previous) => (previous.includes(key) ? previous : [...previous, key]))
  }, [])

  const addNode = useCallback(
    (spec: NewNodeSpec) => {
      if (!primaryGraph) return
      const created = newNodeFromSpec(spec, new Set(Object.keys(primaryGraph.nodes)))
      const lowestY = Math.max(0, ...Object.values(primaryGraph.nodes).map((each) => each.position?.y ?? 0))
      const positioned = { ...created, position: { x: 0, y: lowestY + 170 } }

      updateFlow(primaryFlowKey, (graph) => ({ ...graph, nodes: { ...graph.nodes, [positioned.id]: positioned } }))
      setEditingRef({ flowKey: primaryFlowKey, nodeId: positioned.id })
      // Nó novo não tem ligação, e o layout manda órfão para a coluna extra — num canvas mesclado
      // isso cai fora da área visível, e o card parece não ter sido criado.
      setPendingFocusNodeId(namespaceNodeId(primaryFlowKey, positioned.id))
    },
    [primaryGraph, primaryFlowKey, updateFlow],
  )

  const changeNode = useCallback(
    (updated: FlowNodeData) => {
      if (!editingRef) return
      updateFlow(editingRef.flowKey, (graph) => ({ ...graph, nodes: { ...graph.nodes, [updated.id]: updated } }))
      setEditingRef(undefined)
    },
    [editingRef, updateFlow],
  )

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (!editingRef) return
      updateFlow(editingRef.flowKey, (graph) => ({ ...graph, nodes: removeNodeAndCleanRefs(graph.nodes, nodeId) }))
      setEditingRef(undefined)
    },
    [editingRef, updateFlow],
  )

  const connect = useCallback(
    (connection: ConnectionRequest) => {
      const resolved = resolveConnection({ connection, graphs: workingGraphs })
      if (!resolved) return
      updateFlow(resolved.flowKey, (graph) => {
        const node = graph.nodes[resolved.nodeId]
        if (!node) return graph
        return { ...graph, nodes: { ...graph.nodes, [resolved.nodeId]: applyConnection(node, resolved) } }
      })
    },
    [workingGraphs, updateFlow],
  )

  const moveNode = useCallback(
    (ref: FlowNodeRef, position: FlowNodePosition) => {
      renderedPositions.current.set(namespaceNodeId(ref.flowKey, ref.nodeId), position)
      updateFlow(ref.flowKey, (graph) =>
        graph.nodes[ref.nodeId]
          ? { ...graph, nodes: { ...graph.nodes, [ref.nodeId]: { ...graph.nodes[ref.nodeId]!, position } } }
          : graph,
      )
    },
    [updateFlow],
  )

  /** Único caminho que move card sozinho — no resto do tempo as posições são estáveis. */
  const organize = useCallback(() => {
    if (!primaryGraph) return
    renderedPositions.current.clear()

    if (openFlowKeys.length > 1) {
      const positions = computeMergedLayout({ openKeys: openFlowKeys, graphs: workingGraphs, primaryFlowKey })
      for (const key of openFlowKeys) {
        updateFlow(key, (graph) => ({
          ...graph,
          nodes: Object.fromEntries(
            Object.entries(graph.nodes).map(([id, node]) => {
              const position = positions.get(namespaceNodeId(key, id))
              return [id, position ? { ...node, position } : node]
            }),
          ),
        }))
      }
      return
    }

    const positions = computeAutoLayout(primaryGraph)
    updateFlow(primaryFlowKey, (graph) => ({
      ...graph,
      nodes: Object.fromEntries(
        Object.entries(graph.nodes).map(([id, node]) => [id, { ...node, position: positions[id] ?? node.position }]),
      ),
    }))
  }, [primaryGraph, openFlowKeys, workingGraphs, primaryFlowKey, updateFlow])

  /** Sem isto, a única saída de uma edição indesejada era recarregar — que perde o resto também. */
  const discard = useCallback(() => {
    if (!graphs || dirtyKeys.length === 0) return
    if (!window.confirm(labels.workspace.discardConfirm)) return
    setWorkingGraphs((previous) => {
      const next = { ...previous }
      for (const key of dirtyKeys) {
        if (graphs[key]) next[key] = graphs[key]
      }
      return next
    })
    renderedPositions.current.clear()
    setEditingRef(undefined)
  }, [graphs, dirtyKeys, labels.workspace.discardConfirm])

  const publish = useCallback(async () => {
    // Erro bloqueia porque salvar já é publicar: o motor do bot lê o grafo em tempo real.
    if (dirtyKeys.length === 0 || errorCount > 0) return
    setSaveState('saving')
    setSaveErrorMessage(undefined)

    try {
      await Promise.all(dirtyKeys.map((key) => apiRef.current.saveGraph(key, workingGraphs[key]!)))
      await graphsResource.refetch()
      setSaveState('success')
    } catch (error) {
      setSaveState('error')
      setSaveErrorMessage(error instanceof Error ? error.message : undefined)
    }
  }, [dirtyKeys, errorCount, workingGraphs, graphsResource])

  /** Depois de criar ou excluir fluxo, o rascunho local não vale mais — recomeça da raiz. */
  const resetTo = useCallback(
    async (key: string) => {
      await graphsResource.refetch()
      setWorkingGraphs({})
      setOpenFlowKeys([key])
      setHasAutoMerged(false)
      setEditingRef(undefined)
      renderedPositions.current.clear()
    },
    [graphsResource],
  )

  const editingGraph = editingRef ? workingGraphs[editingRef.flowKey] : undefined
  const editingNode = editingGraph && editingRef ? editingGraph.nodes[editingRef.nodeId] : undefined

  const otherFlows = useMemo(
    () =>
      Object.values(graphs ?? {})
        .filter((each) => each.key !== editingRef?.flowKey)
        .map((each) => ({ key: each.key, label: each.label })),
    [graphs, editingRef?.flowKey],
  )

  return {
    graphs,
    loading: graphsResource.loading && !graphs,
    loadError: graphsResource.error !== undefined,
    livePositions,
    openFlowKeys,
    primaryFlowKey,
    primaryGraph,
    workingGraphs,
    issuesByFlow,
    errorCount,
    warningCount,
    isDirty: dirtyKeys.length > 0,
    saveState,
    saveErrorMessage,
    editingRef,
    editingGraph,
    editingNode,
    otherFlows,
    renderedPositions,
    pendingFocusNodeId,
    clearPendingFocus: useCallback(() => setPendingFocusNodeId(undefined), []),
    selectNode: useCallback((ref: FlowNodeRef) => setEditingRef(ref), []),
    closePanel: useCallback(() => setEditingRef(undefined), []),
    focusFlow,
    closeFlow,
    mergeFlow,
    addNode,
    changeNode,
    deleteNode,
    connect,
    moveNode,
    organize,
    discard,
    publish,
    resetTo,
  }
}

export type FlowsEditor = ReturnType<typeof useFlowsEditor>
