import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  applyNodeChanges,
  type Node,
  type NodeChange,
  type Edge,
  type Connection,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus, Trash2, LayoutGrid, AlertTriangle, AlertCircle, Save, Undo2, Map as MapIcon, Workflow } from 'lucide-react'

import { useIsDarkTheme } from '../useDarkMode'
import { flowNodeTypes, nodeLabel, type FlowNodeCardData } from './FlowNodeCard'
import { flowPortalNodeTypes, type FlowPortalNodeData } from './FlowPortalNode'
import { flowGroupHeaderNodeTypes, type FlowGroupHeaderData } from './FlowGroupHeader'
import { flowGroupFrameNodeTypes, type FlowGroupFrameData } from './FlowGroupFrame'
import { FlowNodePanel } from './FlowNodePanel'
import { FlowPalette, type FlowPaletteActionOption, type NewNodeSpec } from './FlowPalette'
import { FlowMapCanvas } from './FlowMapCanvas'
import { mergeFlowEditorLabels, type FlowEditorLabels } from './labels'
import {
  computeAutoLayout,
  slugifyNodeId,
  targetsOf,
  validateGraph,
  isCrossFlowTarget,
  crossFlowKey,
  crossFlowTargetsOf,
  findCollectionChains,
  estimateNodeHeight,
  NODE_CARD_WIDTH,
  CROSS_FLOW_PREFIX,
  type FlowGraphData,
  type FlowNodeData,
  type GraphIssue,
} from './flowGraph'

const RF_NODE_TYPES = {
  ...flowNodeTypes,
  ...flowPortalNodeTypes,
  ...flowGroupHeaderNodeTypes,
  ...flowGroupFrameNodeTypes,
}

const CHAIN_FRAME_PADDING = 36
const COLUMN_GAP = 360
const ROW_GAP = 40
const NS_SEP = '::'
const FLOW_KEY_PATTERN = /^[a-z0-9_]{2,40}$/

const EDGE_COLOR_LINEAR = '#94a3b8'
const EDGE_COLOR_BRANCH = '#8b5cf6'
const EDGE_COLOR_FALLBACK = '#cbd5e1'
const EDGE_COLOR_LIVE = '#3b82f6'
const EDGE_COLOR_CROSS_FLOW = '#06b6d4'
const BACKGROUND_COLOR_LIGHT = '#cbd5e1'
const BACKGROUND_COLOR_DARK = '#334155'

/** Onde cada conversa viva está parada agora, para o card pulsar com a contagem. */
export interface FlowLivePosition {
  currentState: string
  flow: string | null
  nodeId: string | null
  menuNodeId: string | null
}

export interface CreateFlowInput {
  key: string
  label: string
  showInMenu: boolean
  /** Ausente quando `showInMenu` é falso — não há opção de menu para rotular. */
  menuOptionLabel?: string
}

/**
 * Backend de fluxos do host. Funções cruas em vez de um cliente HTTP: o pacote roda em produtos com
 * axios, fetch e react-query, e nenhum deles precisa entrar como dependência daqui.
 */
export interface FlowsWorkspaceApi {
  getGraphs(): Promise<Record<string, FlowGraphData>>
  saveGraph(key: string, graph: FlowGraphData): Promise<void>
  /**
   * Criar e excluir fluxo são **opcionais por capacidade**: produto cujos fluxos vêm de um seed
   * versionado não expõe rota para isso, e a tela simplesmente não desenha os botões — em vez de
   * oferecer uma ação que estoura no clique.
   */
  createFlow?(input: CreateFlowInput): Promise<void>
  deleteFlow?(key: string): Promise<void>
  /** Contagem de conversas vivas por nó. Ausente, os cards não pulsam e nada é consultado. */
  getLivePositions?(): Promise<FlowLivePosition[]>
}

export interface FlowsWorkspaceProps {
  readonly api: FlowsWorkspaceApi
  /** Fluxo raiz — o que abre por padrão e o único que não pode ser excluído. */
  readonly rootFlowKey?: string
  readonly labels?: Partial<FlowEditorLabels>
  /** Kinds de ação do produto oferecidos na paleta (`trigger_simulation`, `abrir_comanda`…). */
  readonly actionOptions?: readonly FlowPaletteActionOption[]
  /** Seletor de arquivos do nó `send_media` — a biblioteca é do host, então entra por slot. */
  // Recebe o grafo junto do nó: com fluxos fundidos, o nó em edição pode pertencer a um fluxo que
  // não é o raiz, e o seletor do host precisa da chave dele para saber onde gravar.
  readonly renderMediaPicker?: (node: FlowNodeData, graph: FlowGraphData) => ReactNode
  /** Intervalo do polling de posições vivas. Só tem efeito com `getLivePositions`. */
  readonly livePollIntervalMs?: number
  readonly className?: string
}

// Um portal por (nó de origem, fluxo alvo) — se duas opções do mesmo nó apontarem pro mesmo
// fluxo, compartilham um único portal (menos poluição visual, ainda uma ligação por opção).
function portalNodeId(sourceId: string, target: string): string {
  return `__portal__${sourceId}__${target}`
}

// Namespacing de ids: com fusão editável, nós de fluxos diferentes convivem no mesmo canvas
// React Flow, que exige ids únicos globalmente — "flowKey::nodeId" evita colisão entre fluxos
// que reutilizem o mesmo id de nó (ex.: vários fluxos com um nó "root").
function ns(flowKey: string, nodeId: string): string {
  return `${flowKey}${NS_SEP}${nodeId}`
}

function parseNs(id: string): { flowKey: string; nodeId: string } {
  const index = id.indexOf(NS_SEP)
  return index === -1
    ? { flowKey: '', nodeId: id }
    : { flowKey: id.slice(0, index), nodeId: id.slice(index + NS_SEP.length) }
}

// Um fluxo aberto no canvas de detalhe — o primeiro da lista é o "primário" (dono da paleta,
// organizar, publicar e excluir-fluxo); os demais chegaram por fusão editável (clique num portal)
// e ficam com um cabeçalho flutuante pra focar neles sozinhos ou fechar.
type OpenFlow = { key: string; offset: { x: number; y: number } }

// Fecho transitivo de saltos flow:<key> a partir de rootKey — "o fluxo completo": abrir um
// fluxo já traz junto tudo que ele referencia (e o que essas referências referenciam), sem
// precisar clicar em cada portal manualmente.
function autoMergeAll(rootKey: string, graphsSource: Record<string, FlowGraphData>): OpenFlow[] {
  const visited = new Set<string>()
  const queue = [rootKey]
  while (queue.length > 0) {
    const key = queue.shift()!
    if (visited.has(key) || !graphsSource[key]) continue
    visited.add(key)
    for (const target of crossFlowTargetsOf(graphsSource[key]!)) {
      if (!visited.has(target) && graphsSource[target]) queue.push(target)
    }
  }
  return [...visited].map((key) => ({ key, offset: { x: 0, y: 0 } }))
}

// Layout único pra TODOS os nós de TODOS os fluxos abertos juntos — ao contrário de posicionar
// cada fluxo independente e só deslocar (que não evita sobreposição entre fluxos nem considera a
// altura real de cada card), aqui o ranqueamento por BFS roda sobre o grafo mesclado inteiro,
// usando ligações reais (inclusive saltos flow:<key> já resolvidos pro nó inicial do fluxo
// alvo). Mesma orientação do computeAutoLayout: da esquerda para a direita, um rank por coluna.
function computeMergedLayout(
  openFlows: readonly OpenFlow[],
  workingGraphs: Record<string, FlowGraphData>,
  primaryFlowKey: string,
): Map<string, { x: number; y: number }> {
  const openKeys = new Set(openFlows.map((flow) => flow.key))

  const nodeByNsId = new Map<string, FlowNodeData>()
  for (const { key } of openFlows) {
    const graph = workingGraphs[key]
    if (!graph) continue
    for (const node of Object.values(graph.nodes)) nodeByNsId.set(ns(key, node.id), node)
  }

  function forwardEdges(flowKey: string, node: FlowNodeData): string[] {
    const result: string[] = []
    for (const { target } of targetsOf(node)) {
      if (isCrossFlowTarget(target)) {
        const targetFlowKey = crossFlowKey(target)
        const targetGraph = openKeys.has(targetFlowKey) ? workingGraphs[targetFlowKey] : undefined
        if (targetGraph) result.push(ns(targetFlowKey, targetGraph.startNodeId))
      } else if (workingGraphs[flowKey]?.nodes[target]) {
        result.push(ns(flowKey, target))
      }
    }
    return result
  }

  const rank = new Map<string, number>()
  const primaryGraph = workingGraphs[primaryFlowKey]
  const rootId = primaryGraph ? ns(primaryFlowKey, primaryGraph.startNodeId) : undefined
  if (rootId && nodeByNsId.has(rootId)) {
    rank.set(rootId, 0)
    const queue = [rootId]
    while (queue.length > 0) {
      const id = queue.shift()!
      const node = nodeByNsId.get(id)
      if (!node) continue
      for (const nextId of forwardEdges(parseNs(id).flowKey, node)) {
        if (!rank.has(nextId)) {
          rank.set(nextId, rank.get(id)! + 1)
          queue.push(nextId)
        }
      }
    }
  }

  // Nós não alcançados a partir do início do fluxo primário (outro fluxo mesclado sem ligação
  // de volta pro primário, ou nó órfão) vão TODOS numa única camada extra abaixo de tudo — uma
  // camada por órfão empurrava cada um para uma linha própria, cada vez mais longe da área
  // visível, e desligar um fio dava a impressão de ter apagado o card.
  const strayRank = Math.max(0, ...rank.values()) + 1
  for (const nsId of nodeByNsId.keys()) {
    if (!rank.has(nsId)) rank.set(nsId, strayRank)
  }

  const layers = new Map<number, string[]>()
  for (const [nsId, nodeRank] of rank) {
    if (!layers.has(nodeRank)) layers.set(nodeRank, [])
    layers.get(nodeRank)!.push(nsId)
  }

  const positions = new Map<string, { x: number; y: number }>()
  for (const nodeRank of [...layers.keys()].sort((a, b) => a - b)) {
    // Alinhado pelo topo pelo mesmo motivo de `computeAutoLayout`: coluna centralizada saltava
    // inteira a cada nó a mais num ramo.
    let cursorY = 0
    for (const nsId of layers.get(nodeRank)!) {
      positions.set(nsId, { x: nodeRank * COLUMN_GAP, y: cursorY })
      cursorY += estimateNodeHeight(nodeByNsId.get(nsId)!) + ROW_GAP
    }
  }
  return positions
}

function computeLiveCounts(
  flowKey: string,
  rootFlowKey: string,
  livePositions: readonly FlowLivePosition[] | undefined,
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const position of livePositions ?? []) {
    if (position.flow !== flowKey && flowKey !== rootFlowKey) continue
    const nodeId = flowKey === rootFlowKey ? position.menuNodeId : position.nodeId
    if (!nodeId) continue
    counts[nodeId] = (counts[nodeId] ?? 0) + 1
  }
  return counts
}

// Constrói as ligações de TODOS os fluxos abertos juntos. Um salto "flow:<key>" vira ligação
// real até o nó inicial do fluxo alvo quando esse fluxo já está mesclado no canvas; caso
// contrário, continua indo até o portal (pseudo-nó) daquele fluxo, como antes da fusão.
function buildAllEdges(
  openFlows: readonly OpenFlow[],
  workingGraphs: Record<string, FlowGraphData>,
  rootFlowKey: string,
  livePositions: readonly FlowLivePosition[] | undefined,
): Edge[] {
  const openKeys = new Set(openFlows.map((flow) => flow.key))
  const edges: Edge[] = []

  for (const { key: flowKey } of openFlows) {
    const graph = workingGraphs[flowKey]
    if (!graph) continue
    const liveCounts = computeLiveCounts(flowKey, rootFlowKey, livePositions)

    for (const [id, node] of Object.entries(graph.nodes)) {
      const isLive = (liveCounts[id] ?? 0) > 0
      for (const { target, optionId, isDefault } of targetsOf(node)) {
        const crossFlow = isCrossFlowTarget(target)
        let targetFlowKey = flowKey
        let rawTargetId = target
        if (crossFlow) {
          const wantedKey = crossFlowKey(target)
          const targetGraph = openKeys.has(wantedKey) ? workingGraphs[wantedKey] : undefined
          if (targetGraph) {
            targetFlowKey = wantedKey
            rawTargetId = targetGraph.startNodeId
          } else {
            rawTargetId = portalNodeId(id, target)
          }
        }
        const source = ns(flowKey, id)
        const edgeTarget = ns(targetFlowKey, rawTargetId)

        if (optionId === undefined && !isDefault) {
          const color = crossFlow ? EDGE_COLOR_CROSS_FLOW : isLive ? EDGE_COLOR_LIVE : EDGE_COLOR_LINEAR
          edges.push({
            id: `${source}->${edgeTarget}`,
            source,
            target: edgeTarget,
            type: 'bezier',
            animated: isLive,
            style: crossFlow
              ? { stroke: color, strokeWidth: 1.5, strokeDasharray: '3 3' }
              : { stroke: color, strokeWidth: isLive ? 2.5 : 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
          })
        } else if (isDefault) {
          const color = crossFlow ? EDGE_COLOR_CROSS_FLOW : EDGE_COLOR_FALLBACK
          edges.push({
            id: `${source}->${edgeTarget}-default`,
            source,
            sourceHandle: '__default',
            target: edgeTarget,
            type: 'bezier',
            style: { stroke: color, strokeWidth: 1.5, strokeDasharray: '5 4' },
            markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
          })
        } else {
          const color = crossFlow ? EDGE_COLOR_CROSS_FLOW : isLive ? EDGE_COLOR_LIVE : EDGE_COLOR_BRANCH
          edges.push({
            id: `${source}->${edgeTarget}-${optionId}`,
            source,
            sourceHandle: optionId,
            target: edgeTarget,
            type: 'bezier',
            animated: isLive,
            style: crossFlow
              ? { stroke: color, strokeWidth: 1.75, strokeDasharray: '3 3' }
              : { stroke: color, strokeWidth: isLive ? 2.5 : 1.75 },
            markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
          })
        }
      }
    }
  }
  return edges
}

function newNodeFromSpec(spec: NewNodeSpec, existingIds: Set<string>): FlowNodeData {
  if (spec.kind === 'question') {
    const id = slugifyNodeId('nova_pergunta', existingIds)
    return { id, type: 'question', questionType: spec.questionType, contextKey: id, question: '' }
  }
  if (spec.kind === 'decision') {
    const id = slugifyNodeId('nova_decisao', existingIds)
    return {
      id,
      type: 'question',
      questionType: 'choice',
      contextKey: id,
      question: '',
      options: [
        ['1', 'Opção 1'],
        ['2', 'Opção 2'],
      ],
    }
  }
  if (spec.kind === 'condition') {
    const id = slugifyNodeId('nova_condicao', existingIds)
    return { id, type: 'condition', conditionOperator: '>' }
  }
  const id = slugifyNodeId('nova_acao', existingIds)
  return { id, type: 'action', actionKind: spec.actionKind }
}

// Remove referências ao nó excluído: destinos apontando para ele viram '' (destino vazio),
// para a validação sinalizar claramente em vez de manter uma string órfã silenciosa.
function removeNodeAndCleanRefs(
  nodes: Record<string, FlowNodeData>,
  nodeId: string,
): Record<string, FlowNodeData> {
  const { [nodeId]: _removed, ...rest } = nodes
  return Object.fromEntries(
    Object.entries(rest).map(([id, node]) => {
      if (!node.next) return [id, node]
      if (typeof node.next === 'string') {
        return [id, node.next === nodeId ? { ...node, next: undefined } : node]
      }
      return [
        id,
        {
          ...node,
          next: {
            byAnswer: Object.fromEntries(
              Object.entries(node.next.byAnswer).map(([key, value]) => [key, value === nodeId ? '' : value]),
            ),
            default: node.next.default === nodeId ? '' : node.next.default,
          },
        },
      ]
    }),
  )
}

function extractErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) return error.message
  return undefined
}

const OUTLINE_BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-blue-300 disabled:opacity-40 disabled:cursor-not-allowed'
const PRIMARY_BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed'
const DIALOG_INPUT =
  'w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

/**
 * Editor de fluxograma completo — barra de ações, abas de fluxo, paleta, canvas com fusão
 * editável, painel de nó, mapa de fluxos e diálogos de criar/excluir.
 *
 * É a tela inteira, não as peças: cada produto que remontava esse grid à mão acabava com uma
 * versão diferente do mesmo editor. Customização entra por `labels`, `actionOptions` e
 * `renderMediaPicker` — nunca por cópia do arquivo.
 */
export function FlowsWorkspace({
  api,
  rootFlowKey = 'menu',
  labels: labelsOverride,
  actionOptions,
  renderMediaPicker,
  livePollIntervalMs = 5000,
  className,
}: FlowsWorkspaceProps) {
  const labels = useMemo(() => mergeFlowEditorLabels(labelsOverride), [labelsOverride])
  const isDark = useIsDarkTheme()

  const [graphs, setGraphs] = useState<Record<string, FlowGraphData> | undefined>(undefined)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [livePositions, setLivePositions] = useState<FlowLivePosition[] | undefined>(undefined)
  const [viewMode, setViewMode] = useState<'detail' | 'map'>('detail')
  const [openFlows, setOpenFlows] = useState<OpenFlow[]>([{ key: rootFlowKey, offset: { x: 0, y: 0 } }])
  const [hasAutoMerged, setHasAutoMerged] = useState(false)
  const [workingGraphs, setWorkingGraphs] = useState<Record<string, FlowGraphData>>({})
  const [editingRef, setEditingRef] = useState<{ flowKey: string; nodeId: string } | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | undefined>(undefined)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [newFlow, setNewFlow] = useState({ key: '', label: '', showInMenu: false, menuOptionLabel: '' })
  const [flowMutationState, setFlowMutationState] = useState<{ pending: boolean; error?: string }>({ pending: false })
  const [rfNodes, setRfNodes] = useState<Node[]>([])
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [pendingFocusNodeId, setPendingFocusNodeId] = useState<string | null>(null)

  const reloadGraphs = useCallback(async () => {
    try {
      const loaded = await api.getGraphs()
      setGraphs(loaded)
      setLoadState('ready')
      return loaded
    } catch {
      setLoadState('error')
      return undefined
    }
  }, [api])

  useEffect(() => {
    void reloadGraphs()
  }, [reloadGraphs])

  // Polling das posições vivas. `active` corta a resposta que chega depois do desmonte — o
  // intervalo é longo o bastante para uma resposta lenta atravessar a troca de tela.
  useEffect(() => {
    const fetchLive = api.getLivePositions
    if (!fetchLive) return
    let active = true
    async function poll(): Promise<void> {
      try {
        const positions = await fetchLive!()
        if (active) setLivePositions(positions)
      } catch {
        // Contagem viva é enfeite: falhar aqui não pode derrubar o editor.
      }
    }
    void poll()
    const timer = setInterval(() => void poll(), livePollIntervalMs)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [api, livePollIntervalMs])

  const primaryFlowKey = openFlows[0]?.key ?? rootFlowKey
  const primaryGraph = workingGraphs[primaryFlowKey]

  // Assim que os fluxos carregam pela primeira vez, mescla automaticamente todo o fecho
  // transitivo referenciado a partir da raiz — "o fluxo completo" aparece de cara, sem precisar
  // clicar em cada portal. Só roda uma vez (hasAutoMerged); depois disso, focar/mesclar/fechar
  // fica inteiramente sob controle do usuário.
  useEffect(() => {
    if (!graphs || hasAutoMerged) return
    setOpenFlows(autoMergeAll(rootFlowKey, graphs))
    setHasAutoMerged(true)
  }, [graphs, hasAutoMerged, rootFlowKey])

  // Semeia o rascunho local de qualquer fluxo recém-aberto (seleção inicial, foco ou fusão) —
  // nunca sobrescreve um fluxo que já tem rascunho (preserva edições não publicadas mesmo em
  // recargas de fundo).
  useEffect(() => {
    if (!graphs) return
    setWorkingGraphs((prev) => {
      let changed = false
      const next = { ...prev }
      for (const { key } of openFlows) {
        if (!next[key] && graphs[key]) {
          next[key] = graphs[key]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [graphs, openFlows])

  const isFlowDirty = useCallback(
    (key: string): boolean => {
      const working = workingGraphs[key]
      const server = graphs?.[key]
      if (!working || !server) return false
      return JSON.stringify(working) !== JSON.stringify(server)
    },
    [workingGraphs, graphs],
  )

  const issuesByFlow = useMemo<Record<string, GraphIssue[]>>(() => {
    const map: Record<string, GraphIssue[]> = {}
    for (const { key } of openFlows) {
      const graph = workingGraphs[key]
      if (graph) map[key] = validateGraph(graph, labels.validation)
    }
    return map
  }, [openFlows, workingGraphs, labels])

  const errorCount = Object.values(issuesByFlow).reduce(
    (sum, list) => sum + list.filter((issue) => issue.severity === 'error').length,
    0,
  )
  const warningCount = Object.values(issuesByFlow).reduce(
    (sum, list) => sum + list.filter((issue) => issue.severity === 'warning').length,
    0,
  )
  const dirtyKeys = openFlows.map((flow) => flow.key).filter(isFlowDirty)
  const isDirty = dirtyKeys.length > 0

  const updateFlow = useCallback((flowKey: string, updater: (graph: FlowGraphData) => FlowGraphData) => {
    setWorkingGraphs((prev) => {
      const graph = prev[flowKey]
      if (!graph) return prev
      return { ...prev, [flowKey]: updater(graph) }
    })
  }, [])

  // "Focar": troca o fluxo primário e re-mescla o fecho transitivo dele (o fluxo completo
  // referenciado a partir dele) — não isola mais num único fluxo sozinho, já que o padrão
  // agora é sempre mostrar tudo que está conectado.
  const focusFlow = useCallback(
    (key: string) => {
      const others = openFlows.filter((flow) => flow.key !== key)
      if (others.some((flow) => isFlowDirty(flow.key)) && !window.confirm(labels.workspace.unsavedChangesConfirm)) return
      setOpenFlows(graphs ? autoMergeAll(key, graphs) : [{ key, offset: { x: 0, y: 0 } }])
      if (editingRef && editingRef.flowKey !== key) setEditingRef(null)
    },
    [openFlows, isFlowDirty, editingRef, graphs, labels],
  )

  // "Fechar": remove um fluxo mesclado sem trocar o foco do primário.
  const closeFlow = useCallback(
    (key: string) => {
      if (isFlowDirty(key) && !window.confirm(labels.workspace.unsavedChangesConfirm)) return
      setOpenFlows((prev) => prev.filter((flow) => flow.key !== key))
      setWorkingGraphs((prev) => {
        const { [key]: _removed, ...rest } = prev
        return rest
      })
      if (editingRef?.flowKey === key) setEditingRef(null)
    },
    [isFlowDirty, editingRef, labels],
  )

  // Fusão editável: mescla o fluxo alvo no mesmo canvas, posicionado à direita do nó de
  // origem que o referenciou, com os nós de verdade (editáveis ali mesmo) em vez de um portal.
  const mergeFlow = useCallback(
    (targetFlowKey: string, source: { flowKey: string; nodeId: string }) => {
      setOpenFlows((prev) => {
        if (prev.some((flow) => flow.key === targetFlowKey)) return prev
        const sourceOpen = prev.find((flow) => flow.key === source.flowKey)
        const sourceGraph = workingGraphs[source.flowKey]
        const sourceLocalPosition =
          sourceGraph?.nodes[source.nodeId]?.position ??
          (sourceGraph ? computeAutoLayout(sourceGraph)[source.nodeId] : undefined) ?? { x: 0, y: 0 }
        const baseOffset = sourceOpen?.offset ?? { x: 0, y: 0 }
        return [
          ...prev,
          {
            key: targetFlowKey,
            offset: {
              x: baseOffset.x + sourceLocalPosition.x + 400,
              y: baseOffset.y + sourceLocalPosition.y,
            },
          },
        ]
      })
    },
    [workingGraphs],
  )

  // Mais de um fluxo aberto = layout global (ignora node.position individual, recalcula tudo
  // junto pra nunca sobrepor); um só fluxo aberto = comportamento de sempre (respeita posição
  // salva/arrastada, com fallback pro auto-layout daquele fluxo isolado).
  const isMerged = openFlows.length > 1
  const mergedPositions = useMemo(
    () => (isMerged ? computeMergedLayout(openFlows, workingGraphs, primaryFlowKey) : null),
    [isMerged, openFlows, workingGraphs, primaryFlowKey],
  )

  // Última posição em que cada nó foi desenhado, e ela manda sobre o layout calculado.
  //
  // O layout mesclado é recalculado a cada mudança de topologia: ligar ou desligar um fio mexia
  // no rank de todo mundo e o canvas inteiro saltava de lugar — o card que perdeu a ligação ia
  // parar na faixa dos órfãos e os demais mudavam de coluna, o que se lê como "o card sumiu".
  // Aqui o layout vira só a semente de quem ainda não tem lugar; o resto fica onde está até o
  // usuário arrastar ou pedir "Organizar".
  const renderedPositionsRef = useRef(new Map<string, { x: number; y: number }>())

  const derivedNodes = useMemo<Node[]>(() => {
    const allNodes: Node[] = []
    for (const { key: flowKey, offset } of openFlows) {
      const graph = workingGraphs[flowKey]
      if (!graph) continue
      const fallbackPositions = mergedPositions ? {} : computeAutoLayout(graph)
      const liveCounts = computeLiveCounts(flowKey, rootFlowKey, livePositions)
      const flowIssues = issuesByFlow[flowKey] ?? []
      const isPrimary = flowKey === primaryFlowKey

      // Quem recebe fio de alguém neste fluxo. O que sobra (fora o nó inicial) está solto: o card
      // ganha contorno tracejado e pulsa, para desconectar ou criar um nó ficar visivelmente
      // "falta ligar isto aqui" em vez de silencioso.
      const connectedTargets = new Set<string>()
      for (const candidate of Object.values(graph.nodes)) {
        for (const { target } of targetsOf(candidate)) {
          if (!isCrossFlowTarget(target)) connectedTargets.add(target)
        }
      }

      function resolvePosition(nodeId: string): { x: number; y: number } {
        if (mergedPositions) {
          const nsId = ns(flowKey, nodeId)
          return renderedPositionsRef.current.get(nsId) ?? mergedPositions.get(nsId) ?? { x: 0, y: 0 }
        }
        const local = graph!.nodes[nodeId]?.position ?? fallbackPositions[nodeId] ?? { x: 0, y: 0 }
        return { x: local.x + offset.x, y: local.y + offset.y }
      }

      for (const node of Object.values(graph.nodes)) {
        const position = resolvePosition(node.id)
        allNodes.push({
          id: ns(flowKey, node.id),
          type: 'flowNode',
          position,
          draggable: true,
          data: {
            node,
            liveCount: liveCounts[node.id] ?? 0,
            isStart: node.id === graph.startNodeId,
            isSelected: editingRef?.flowKey === flowKey && editingRef?.nodeId === node.id,
            isDetached: node.id !== graph.startNodeId && !connectedTargets.has(node.id),
            issues: flowIssues,
            labels,
            onSelect: (nodeId: string) => setEditingRef({ flowKey, nodeId }),
          } satisfies FlowNodeCardData,
        })

        // Um portal por (nó de origem, fluxo alvo único) — só para saltos cujo fluxo alvo AINDA
        // não está mesclado no canvas (hoje raro, já que abrir um fluxo já mescla tudo que ele
        // referencia — mas serve de rede de segurança pra um fluxo criado depois da fusão
        // inicial); se já estiver mesclado, buildAllEdges liga direto ao nó real.
        const crossFlowTargets = [...new Set(targetsOf(node).map((edge) => edge.target).filter(isCrossFlowTarget))]
        crossFlowTargets.forEach((target, index) => {
          const targetFlowKey = crossFlowKey(target)
          if (openFlows.some((flow) => flow.key === targetFlowKey)) return
          allNodes.push({
            id: ns(flowKey, portalNodeId(node.id, target)),
            type: 'flowPortal',
            draggable: false,
            selectable: false,
            position: { x: position.x + 320, y: position.y + index * 70 },
            data: {
              label: graphs?.[targetFlowKey]?.label ?? targetFlowKey,
              onNavigate: () => mergeFlow(targetFlowKey, { flowKey, nodeId: node.id }),
            } satisfies FlowPortalNodeData,
          })
        })
      }

      // Moldura decorativa por trás de cada cadeia de perguntas lineares que alimenta uma ação —
      // puramente derivada da topologia do grafo, sem precisar marcar manualmente quais perguntas
      // "pertencem" ao cálculo.
      for (const chain of findCollectionChains(graph)) {
        const chainNodeIds = [...chain.nodeIds, chain.actionNodeId]
        const positions = chainNodeIds.map((id) => resolvePosition(id))
        const minX = Math.min(...positions.map((point) => point.x))
        const maxX = Math.max(...positions.map((point) => point.x)) + NODE_CARD_WIDTH
        const minY = Math.min(...positions.map((point) => point.y))
        const maxY = Math.max(...positions.map((point) => point.y)) + estimateNodeHeight(graph.nodes[chain.actionNodeId]!)
        allNodes.push({
          id: ns(flowKey, `__chain__${chain.actionNodeId}`),
          type: 'flowGroupFrame',
          draggable: false,
          selectable: false,
          zIndex: -1,
          position: { x: minX - CHAIN_FRAME_PADDING, y: minY - CHAIN_FRAME_PADDING - 24 },
          style: {
            width: maxX - minX + CHAIN_FRAME_PADDING * 2,
            height: maxY - minY + CHAIN_FRAME_PADDING * 2 + 24,
          },
          data: {
            label: labels.collectionChain.feeds(nodeLabel(graph.nodes[chain.actionNodeId], labels)),
          } satisfies FlowGroupFrameData,
        })
      }

      // Cabeçalho flutuante só para fluxos mesclados (o primário já tem controles na barra
      // de cima — paleta, organizar, publicar, excluir).
      if (!isPrimary) {
        const startPosition = resolvePosition(graph.startNodeId)
        allNodes.push({
          id: ns(flowKey, '__group_header__'),
          type: 'flowGroupHeader',
          draggable: false,
          selectable: false,
          position: { x: startPosition.x, y: startPosition.y - 60 },
          data: {
            label: graph.label,
            onFocus: () => focusFlow(flowKey),
            onClose: () => closeFlow(flowKey),
          } satisfies FlowGroupHeaderData,
        })
      }
    }
    return allNodes
  }, [
    openFlows,
    workingGraphs,
    mergedPositions,
    livePositions,
    issuesByFlow,
    primaryFlowKey,
    rootFlowKey,
    editingRef,
    graphs,
    mergeFlow,
    focusFlow,
    closeFlow,
    labels,
  ])

  const edges = useMemo(
    () => buildAllEdges(openFlows, workingGraphs, rootFlowKey, livePositions),
    [openFlows, workingGraphs, rootFlowKey, livePositions],
  )

  useEffect(() => {
    setRfNodes(derivedNodes)
    for (const node of derivedNodes) {
      if (node.type === 'flowNode') renderedPositionsRef.current.set(node.id, node.position)
    }
  }, [derivedNodes])

  // Nó recém-criado ainda não tem ligação, e o layout manda todo órfão para uma faixa abaixo de
  // tudo — num canvas com vários fluxos mesclados isso cai longe da área visível, e o card parece
  // ter sumido. Espera ele existir no canvas e leva a viewport até lá.
  useEffect(() => {
    if (!pendingFocusNodeId || !flowInstance) return
    const target = rfNodes.find((node) => node.id === pendingFocusNodeId)
    if (!target) return
    flowInstance.setCenter(target.position.x + NODE_CARD_WIDTH / 2, target.position.y, { zoom: 1, duration: 400 })
    setPendingFocusNodeId(null)
  }, [pendingFocusNodeId, flowInstance, rfNodes])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((current) => applyNodeChanges(changes, current))
  }, [])

  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      renderedPositionsRef.current.set(node.id, node.position)
      const { flowKey, nodeId } = parseNs(node.id)
      const openFlow = openFlows.find((flow) => flow.key === flowKey)
      if (!openFlow) return
      const localPosition = { x: node.position.x - openFlow.offset.x, y: node.position.y - openFlow.offset.y }
      updateFlow(flowKey, (graph) =>
        graph.nodes[nodeId]
          ? { ...graph, nodes: { ...graph.nodes, [nodeId]: { ...graph.nodes[nodeId]!, position: localPosition } } }
          : graph,
      )
    },
    [openFlows, updateFlow],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, sourceHandle, target } = connection
      if (!source || !target || source === target) return
      const sourceRef = parseNs(source)
      const targetRef = parseNs(target)

      // Conectar num nó de outro fluxo só faz sentido se for o nó inicial dele — vira um salto
      // "flow:<key>" (o motor do bot não sabe pular pra um nó específico de outro fluxo, só
      // pro início). Conectar num nó do meio de outro fluxo é ignorado silenciosamente.
      let targetValue: string
      if (targetRef.flowKey === sourceRef.flowKey) {
        targetValue = targetRef.nodeId
      } else {
        const targetGraph = workingGraphs[targetRef.flowKey]
        if (!targetGraph || targetGraph.startNodeId !== targetRef.nodeId) return
        targetValue = `${CROSS_FLOW_PREFIX}${targetRef.flowKey}`
      }

      updateFlow(sourceRef.flowKey, (graph) => {
        const node = graph.nodes[sourceRef.nodeId]
        if (!node) return graph
        const handle = sourceHandle ?? 'next'
        const currentByAnswer = typeof node.next === 'object' && node.next ? node.next.byAnswer : {}
        const currentDefault = typeof node.next === 'object' && node.next ? node.next.default : ''
        const updatedNode: FlowNodeData =
          handle === 'next'
            ? { ...node, next: targetValue }
            : handle === '__default'
              ? { ...node, next: { byAnswer: currentByAnswer, default: targetValue } }
              : { ...node, next: { byAnswer: { ...currentByAnswer, [handle]: targetValue }, default: currentDefault } }
        return { ...graph, nodes: { ...graph.nodes, [sourceRef.nodeId]: updatedNode } }
      })
    },
    [workingGraphs, updateFlow],
  )

  function handleAddNode(spec: NewNodeSpec) {
    if (!primaryGraph) return
    const newNode = newNodeFromSpec(spec, new Set(Object.keys(primaryGraph.nodes)))
    const maxY = Math.max(0, ...Object.values(primaryGraph.nodes).map((node) => node.position?.y ?? 0))
    newNode.position = { x: 0, y: maxY + 170 }
    updateFlow(primaryFlowKey, (graph) => ({ ...graph, nodes: { ...graph.nodes, [newNode.id]: newNode } }))
    setEditingRef({ flowKey: primaryFlowKey, nodeId: newNode.id })
    setPendingFocusNodeId(ns(primaryFlowKey, newNode.id))
  }

  function handleNodePanelChange(updated: FlowNodeData) {
    if (!editingRef) return
    updateFlow(editingRef.flowKey, (graph) => ({ ...graph, nodes: { ...graph.nodes, [updated.id]: updated } }))
    setEditingRef(null)
  }

  function handleNodeDelete(nodeId: string) {
    if (!editingRef) return
    updateFlow(editingRef.flowKey, (graph) => ({ ...graph, nodes: removeNodeAndCleanRefs(graph.nodes, nodeId) }))
    setEditingRef(null)
  }

  // Único caminho que move card sozinho — as posições são estáveis no resto do tempo, então
  // reorganizar virou uma ação explícita, inclusive com vários fluxos mesclados no canvas.
  function handleOrganize() {
    if (!primaryGraph) return
    renderedPositionsRef.current.clear()

    if (isMerged) {
      const positions = computeMergedLayout(openFlows, workingGraphs, primaryFlowKey)
      for (const { key, offset } of openFlows) {
        updateFlow(key, (graph) => ({
          ...graph,
          nodes: Object.fromEntries(
            Object.entries(graph.nodes).map(([id, node]) => {
              const position = positions.get(ns(key, id))
              return [
                id,
                position ? { ...node, position: { x: position.x - offset.x, y: position.y - offset.y } } : node,
              ]
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
  }

  // Descarta o rascunho local e volta ao que está publicado. Sem isso, a única saída de uma
  // edição indesejada era recarregar a página no susto — e recarregar também perde o resto.
  function handleDiscardChanges() {
    if (!graphs || !isDirty) return
    if (!window.confirm(labels.workspace.discardConfirm)) return
    setWorkingGraphs((prev) => {
      const next = { ...prev }
      for (const key of dirtyKeys) {
        const published = graphs[key]
        if (published) next[key] = published
      }
      return next
    })
    renderedPositionsRef.current.clear()
    setEditingRef(null)
  }

  async function handlePublish() {
    if (dirtyKeys.length === 0 || errorCount > 0) return
    setSaveState('saving')
    setSaveErrorMessage(undefined)
    try {
      await Promise.all(dirtyKeys.map((key) => api.saveGraph(key, workingGraphs[key]!)))
      await reloadGraphs()
      setSaveState('success')
      setTimeout(() => setSaveState('idle'), 3000)
    } catch (error) {
      setSaveState('error')
      setSaveErrorMessage(extractErrorMessage(error))
    }
  }

  async function handleCreateFlow() {
    const createFlow = api.createFlow
    if (!createFlow) return
    setFlowMutationState({ pending: true })
    try {
      await createFlow({
        key: newFlow.key,
        label: newFlow.label,
        showInMenu: newFlow.showInMenu,
        ...(newFlow.showInMenu ? { menuOptionLabel: newFlow.menuOptionLabel || newFlow.label } : {}),
      })
      await reloadGraphs()
      setOpenFlows([{ key: newFlow.key, offset: { x: 0, y: 0 } }])
      setShowCreateDialog(false)
      setNewFlow({ key: '', label: '', showInMenu: false, menuOptionLabel: '' })
      setFlowMutationState({ pending: false })
    } catch (error) {
      setFlowMutationState({ pending: false, error: extractErrorMessage(error) ?? labels.flowManager.createError })
    }
  }

  async function handleDeleteFlow() {
    const deleteFlow = api.deleteFlow
    if (!deleteFlow || !primaryGraph) return
    setFlowMutationState({ pending: true })
    try {
      await deleteFlow(primaryGraph.key)
      const reloaded = await reloadGraphs()
      setOpenFlows(reloaded ? autoMergeAll(rootFlowKey, reloaded) : [{ key: rootFlowKey, offset: { x: 0, y: 0 } }])
      setShowDeleteDialog(false)
      setFlowMutationState({ pending: false })
    } catch (error) {
      setFlowMutationState({ pending: false, error: extractErrorMessage(error) ?? labels.flowManager.deleteError })
    }
  }

  const editingGraph = editingRef ? workingGraphs[editingRef.flowKey] : null
  const editingNode = editingRef && editingGraph ? editingGraph.nodes[editingRef.nodeId] : null
  const otherFlows = useMemo(
    () =>
      Object.values(graphs ?? {})
        .filter((graph) => graph.key !== editingRef?.flowKey)
        .map((graph) => ({ key: graph.key, label: graph.label })),
    [graphs, editingRef?.flowKey],
  )
  const keyIsValid = FLOW_KEY_PATTERN.test(newFlow.key)
  const canCreateFlow = Boolean(api.createFlow)
  const canDeleteFlow = Boolean(api.deleteFlow) && primaryFlowKey !== rootFlowKey

  return (
    <div className={`space-y-4 h-full flex flex-col ${className ?? ''}`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{labels.workspace.title}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{labels.workspace.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {saveState === 'success' && <span className="text-sm text-green-600">{labels.workspace.saveSuccess}</span>}
          {saveState === 'error' && (
            <span className="text-sm text-red-600">{saveErrorMessage ?? labels.workspace.saveError}</span>
          )}
          <button
            type="button"
            onClick={() => setViewMode((mode) => (mode === 'map' ? 'detail' : 'map'))}
            className={OUTLINE_BUTTON}
          >
            {viewMode === 'map' ? <Workflow size={14} aria-hidden="true" /> : <MapIcon size={14} aria-hidden="true" />}
            {viewMode === 'map' ? labels.flowMap.toggleToDetail : labels.flowMap.toggleToMap}
          </button>
          {viewMode === 'detail' && (
            <>
              <button
                type="button"
                onClick={handleOrganize}
                className={OUTLINE_BUTTON}
                title={labels.workspace.organizeTooltip}
                disabled={!primaryGraph}
              >
                <LayoutGrid size={14} aria-hidden="true" /> {labels.workspace.organize}
              </button>
              <button
                type="button"
                onClick={handleDiscardChanges}
                className={OUTLINE_BUTTON}
                title={labels.workspace.discardTooltip}
                disabled={!isDirty || saveState === 'saving'}
              >
                <Undo2 size={14} aria-hidden="true" /> {labels.workspace.discardChanges}
              </button>
              <button
                type="button"
                onClick={() => void handlePublish()}
                className={PRIMARY_BUTTON}
                disabled={!isDirty || errorCount > 0 || saveState === 'saving'}
              >
                <Save size={14} aria-hidden="true" />
                {saveState === 'saving' ? labels.workspace.saving : labels.workspace.saveGraph}
              </button>
            </>
          )}
        </div>
      </div>

      {viewMode === 'detail' && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {graphs &&
              Object.values(graphs).map((graph) => (
                <button
                  key={graph.key}
                  type="button"
                  onClick={() => focusFlow(graph.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    primaryFlowKey === graph.key
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300'
                  }`}
                >
                  {graph.label}
                </button>
              ))}
            {canCreateFlow && (
              <button
                type="button"
                onClick={() => {
                  setFlowMutationState({ pending: false })
                  setShowCreateDialog(true)
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600"
              >
                <Plus size={12} aria-hidden="true" /> {labels.flowManager.newFlow}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {primaryGraph && (
              <FlowPalette
                onAdd={handleAddNode}
                labels={labels}
                {...(actionOptions ? { actionOptions: [...actionOptions] } : {})}
              />
            )}
            {primaryGraph && canDeleteFlow && (
              <button
                type="button"
                onClick={() => {
                  setFlowMutationState({ pending: false })
                  setShowDeleteDialog(true)
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 size={13} aria-hidden="true" /> {labels.flowManager.deleteFlow}
              </button>
            )}
          </div>
        </div>
      )}

      {viewMode === 'detail' && (errorCount > 0 || warningCount > 0) && (
        <div className="flex items-center gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-xs">
          <span className="font-medium text-gray-600 dark:text-gray-300">{labels.validation.title}:</span>
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
              <AlertCircle size={13} aria-hidden="true" /> {labels.validation.errors(errorCount)}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertTriangle size={13} aria-hidden="true" /> {labels.validation.warnings(warningCount)}
            </span>
          )}
        </div>
      )}

      <div className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden relative">
        {loadState === 'loading' && <p className="text-center text-gray-400 py-12">{labels.workspace.loading}</p>}
        {loadState === 'error' && <p className="text-center text-red-500 py-12">{labels.workspace.loadError}</p>}
        {loadState === 'ready' && graphs && viewMode === 'map' && (
          <FlowMapCanvas
            graphs={graphs}
            rootKey={rootFlowKey}
            labels={labels}
            onOpenFlow={(key) => {
              focusFlow(key)
              setViewMode('detail')
            }}
          />
        )}
        {loadState === 'ready' && viewMode === 'detail' && primaryGraph && (
          <ReactFlow
            nodes={rfNodes}
            edges={edges}
            nodeTypes={RF_NODE_TYPES}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            onInit={setFlowInstance}
            fitView
            proOptions={{ hideAttribution: true }}
            colorMode={isDark ? 'dark' : 'light'}
          >
            <Background color={isDark ? BACKGROUND_COLOR_DARK : BACKGROUND_COLOR_LIGHT} />
            <Controls />
            <MiniMap pannable zoomable className="!bg-white dark:!bg-gray-800" />
          </ReactFlow>
        )}
      </div>

      {/* `key` por nó: o painel guarda um rascunho local em estado, e sem remontar ao trocar de nó
          selecionado ele seguia mostrando (e salvando) os campos do nó anterior. */}
      {editingNode && editingGraph && (
        <FlowNodePanel
          key={`${editingRef?.flowKey}:${editingRef?.nodeId}`}
          graph={editingGraph}
          node={editingNode}
          issues={editingRef ? (issuesByFlow[editingRef.flowKey] ?? []) : []}
          otherFlows={otherFlows}
          labels={labels}
          onClose={() => setEditingRef(null)}
          onChange={handleNodePanelChange}
          onDelete={handleNodeDelete}
          {...(renderMediaPicker ? { renderMediaPicker } : {})}
        />
      )}

      {showCreateDialog && canCreateFlow && (
        <FlowDialog title={labels.flowManager.createTitle} onClose={() => setShowCreateDialog(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{labels.flowManager.label}</label>
              <input
                value={newFlow.label}
                onChange={(event) => setNewFlow((prev) => ({ ...prev, label: event.target.value }))}
                className={`mt-1 ${DIALOG_INPUT}`}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{labels.flowManager.key}</label>
              <input
                value={newFlow.key}
                onChange={(event) => setNewFlow((prev) => ({ ...prev, key: event.target.value.toLowerCase() }))}
                className={`mt-1 ${DIALOG_INPUT}`}
              />
              <p className="text-[11px] text-gray-400 mt-1">
                {newFlow.key && !keyIsValid ? labels.flowManager.keyInvalid : labels.flowManager.keyHint}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                checked={newFlow.showInMenu}
                onChange={(event) => setNewFlow((prev) => ({ ...prev, showInMenu: event.target.checked }))}
              />
              {labels.flowManager.showInMenu}
            </label>
            {newFlow.showInMenu && (
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {labels.flowManager.menuOptionLabel}
                </label>
                <input
                  value={newFlow.menuOptionLabel}
                  onChange={(event) => setNewFlow((prev) => ({ ...prev, menuOptionLabel: event.target.value }))}
                  placeholder={newFlow.label}
                  className={`mt-1 ${DIALOG_INPUT}`}
                />
              </div>
            )}
            {flowMutationState.error && <p className="text-xs text-red-600">{flowMutationState.error}</p>}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" className={OUTLINE_BUTTON} onClick={() => setShowCreateDialog(false)}>
              {labels.nodePanel.cancel}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON}
              onClick={() => void handleCreateFlow()}
              disabled={!keyIsValid || !newFlow.label || flowMutationState.pending}
            >
              {flowMutationState.pending ? labels.flowManager.creating : labels.flowManager.create}
            </button>
          </div>
        </FlowDialog>
      )}

      {showDeleteDialog && canDeleteFlow && (
        <FlowDialog title={labels.flowManager.deleteFlow} onClose={() => setShowDeleteDialog(false)}>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {primaryGraph ? labels.flowManager.deleteConfirm(primaryGraph.label) : ''}
          </p>
          {flowMutationState.error && <p className="text-xs text-red-600 mt-2">{flowMutationState.error}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" className={OUTLINE_BUTTON} onClick={() => setShowDeleteDialog(false)}>
              {labels.nodePanel.cancel}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
              onClick={() => void handleDeleteFlow()}
              disabled={flowMutationState.pending}
            >
              <Trash2 size={13} aria-hidden="true" /> {labels.flowManager.deleteFlow}
            </button>
          </div>
        </FlowDialog>
      )}
    </div>
  )
}

// Diálogo próprio em vez de depender do `Dialog` do produto: o pacote roda em três apps com
// bibliotecas de UI diferentes, e exigir uma delas transformaria a tela composta num acoplamento.
function FlowDialog({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-xl"
      >
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">{title}</h3>
        {children}
      </div>
    </div>
  )
}
