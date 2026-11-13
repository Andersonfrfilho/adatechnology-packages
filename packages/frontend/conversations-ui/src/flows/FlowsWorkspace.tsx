import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Panel,
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
import { NODE_TYPE_COLOR, flowNodeTypes, nodeLabel, type FlowNodeCardData } from './FlowNodeCard'
import { FlowLegend, type FlowLegendEdgeSample } from './FlowLegend'
import { flowPortalNodeTypes, type FlowPortalNodeData } from './FlowPortalNode'
import { flowGroupHeaderNodeTypes, type FlowGroupHeaderData } from './FlowGroupHeader'
import { flowGroupFrameNodeTypes, type FlowGroupFrameData } from './FlowGroupFrame'
import { FlowNodePanel } from './FlowNodePanel'
import { FlowPalette, FlowPaletteMenu, type FlowPaletteActionOption, type NewNodeSpec } from './FlowPalette'
import { flowEdgeTypes, type FlowConnectionEdgeData } from './FlowConnectionEdge'
import { FlowMapCanvas } from './FlowMapCanvas'
import { mergeFlowEditorLabels, type FlowEditorLabels } from './labels'
// Operações puras do grafo, com teste próprio. As decisões que elas tomam não dão erro quando estão
// erradas: dão aresta apontando para nó apagado, ou salto que o motor do bot ignora.
import {
  buildFlowEdges,
  chainFrameBounds,
  chainFrameNodeId,
  computeMergedLayout,
  countLiveByNode,
  findFreeSlot,
  newNodeFromSpec,
  portalNodeId,
  GROUP_HEADER_NODE_ID,
  type FlowEdgeSpec,
  type FlowLivePositionInput,
} from './flowCanvasModel'
import {
  applyConnection,
  clearConnection,
  mergedFlowKeysFrom,
  namespaceNodeId,
  parseNamespacedId,
  removeNodeAndCleanRefs,
  resolveConnection,
} from './flowEditorOps'
import { placeFloatingPanel, type FloatingPlacement } from './flowMenuPlacement'
import {
  computeAutoLayout,
  targetsOf,
  validateGraph,
  isCrossFlowTarget,
  crossFlowKey,
  findCollectionChains,
  estimateNodeHeight,
  NODE_CARD_WIDTH,
  type FlowGraphData,
  type FlowNodeData,
  type GraphIssue,
} from './flowGraph'
import { TooltipLayer } from '../Tooltip'

const RF_NODE_TYPES = {
  ...flowNodeTypes,
  ...flowPortalNodeTypes,
  ...flowGroupHeaderNodeTypes,
  ...flowGroupFrameNodeTypes,
}

/**
 * A legenda lê as mesmas constantes que pintam as arestas — chave que diverge do desenho é pior que
 * chave nenhuma, porque ensina errado com ar de autoridade.
 */
function legendEdgeSamples(labels: FlowEditorLabels): FlowLegendEdgeSample[] {
  return [
    { color: EDGE_COLOR_LINEAR, label: labels.legendPanel.linear },
    { color: EDGE_COLOR_BRANCH, label: labels.legendPanel.branch },
    { color: EDGE_COLOR_FALLBACK, dash: '5 4', label: labels.legendPanel.fallback },
    { color: EDGE_COLOR_CROSS_FLOW, dash: '3 3', label: labels.legendPanel.crossFlow },
    { color: EDGE_COLOR_LIVE, label: labels.legendPanel.live },
  ]
}

const LEGEND_NODE_SWATCHES = (Object.keys(NODE_TYPE_COLOR) as (keyof typeof NODE_TYPE_COLOR)[]).map((type) => ({
  type,
  className: NODE_TYPE_COLOR[type],
}))

const CHAIN_FRAME_PADDING = 36
/** Coluna à direita do card de origem em que o nó criado pelo "+" nasce. */
const QUICK_ADD_COLUMN_GAP = 320
const FLOW_KEY_PATTERN = /^[a-z0-9_]{2,40}$/

const EDGE_COLOR_LINEAR = '#94a3b8'

/** Enquadramento ao focar um fluxo pela aba. */
const FOCUS_MAX_ZOOM = 1
const FOCUS_PADDING = 0.2
const FOCUS_DURATION_MS = 400

/** Folga entre o "+" e o menu que ele abre. */
const QUICK_ADD_MENU_GAP = 12
const EDGE_COLOR_BRANCH = '#8b5cf6'
const EDGE_COLOR_FALLBACK = '#cbd5e1'
const EDGE_COLOR_LIVE = '#3b82f6'
const EDGE_COLOR_CROSS_FLOW = '#06b6d4'
const BACKGROUND_COLOR_LIGHT = '#cbd5e1'
const BACKGROUND_COLOR_DARK = '#334155'

// Os formatos de posição viva moram no modelo, que é quem conta — e são reexportados aqui porque
// fazem parte da api que o produto implementa. Declarar nos dois lugares faria as duas formas
// divergirem em silêncio.
export type { FlowLivePosition, FlowLiveNodeCount, FlowLivePositionInput } from './flowCanvasModel'

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
  /**
   * Onde estão as conversas vivas. Ausente, os cards não pulsam e nada é consultado.
   *
   * Aceita a linha por sessão e a linha já agregada por nó — `meta-whatsapp-module` responde a
   * segunda, e exigir a primeira deixava os cards parados em todo produto que usa o módulo.
   */
  getLivePositions?(): Promise<readonly FlowLivePositionInput[]>
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
  /**
   * Título e subtítulo do editor. `false` deixa só a barra de ações.
   *
   * Produto cuja navegação já nomeia a tela mostrava o nome duas vezes, em dois tamanhos, porque a
   * tipografia daqui é do pacote e a de lá é do host. Esconder é a única saída que não força o
   * pacote a adivinhar a escala tipográfica de cada produto.
   */
  readonly showHeader?: boolean
  readonly className?: string
}

/**
 * Traduz o papel da aresta em traço, cor e seta.
 *
 * O estilo fica aqui e a topologia fica no modelo, de propósito: destino errado é invisível até a
 * conversa do cliente parar; cor errada aparece na primeira olhada.
 */
function styleEdge(spec: FlowEdgeSpec, params: { disconnectLabel: string; onDisconnect: (spec: FlowEdgeSpec) => void }): Edge {
  const color = spec.crossFlow
    ? EDGE_COLOR_CROSS_FLOW
    : spec.kind === 'fallback'
      ? EDGE_COLOR_FALLBACK
      : spec.live
        ? EDGE_COLOR_LIVE
        : spec.kind === 'branch'
          ? EDGE_COLOR_BRANCH
          : EDGE_COLOR_LINEAR
  const baseWidth = spec.kind === 'branch' ? 1.75 : 1.5
  const dash = spec.crossFlow ? '3 3' : spec.kind === 'fallback' ? '5 4' : undefined
  const markerSize = spec.kind === 'fallback' ? 16 : 18

  return {
    id: spec.id,
    source: spec.source,
    target: spec.target,
    ...(spec.sourceHandle === undefined ? {} : { sourceHandle: spec.sourceHandle }),
    type: 'flowConnection',
    reconnectable: 'target',
    data: {
      disconnectLabel: params.disconnectLabel,
      onDisconnect: () => params.onDisconnect(spec),
    } satisfies FlowConnectionEdgeData,
    animated: spec.live,
    style: {
      stroke: color,
      strokeWidth: spec.live && !spec.crossFlow ? 2.5 : baseWidth,
      ...(dash === undefined ? {} : { strokeDasharray: dash }),
    },
    markerEnd: { type: MarkerType.ArrowClosed, color, width: markerSize, height: markerSize },
  }
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
  showHeader = true,
  className,
}: FlowsWorkspaceProps) {
  const labels = useMemo(() => mergeFlowEditorLabels(labelsOverride), [labelsOverride])
  const isDark = useIsDarkTheme()

  const [graphs, setGraphs] = useState<Record<string, FlowGraphData> | undefined>(undefined)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [livePositions, setLivePositions] = useState<readonly FlowLivePositionInput[] | undefined>(undefined)
  const [viewMode, setViewMode] = useState<'detail' | 'map'>('detail')
  const [openFlowKeys, setOpenFlowKeys] = useState<readonly string[]>([rootFlowKey])
  const [hasAutoMerged, setHasAutoMerged] = useState(false)
  const [workingGraphs, setWorkingGraphs] = useState<Record<string, FlowGraphData>>({})
  const [editingRef, setEditingRef] = useState<{ flowKey: string; nodeId: string } | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | undefined>(undefined)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  /** Saída de onde o "+" foi clicado, e o ponto da tela onde ancorar o menu. */
  const [quickAddFrom, setQuickAddFrom] = useState<
    { flowKey: string; nodeId: string; handle: string; anchor: { x: number; y: number } } | null
  >(null)
  const [newFlow, setNewFlow] = useState({ key: '', label: '', showInMenu: false, menuOptionLabel: '' })
  const [flowMutationState, setFlowMutationState] = useState<{ pending: boolean; error?: string }>({ pending: false })
  const [rfNodes, setRfNodes] = useState<Node[]>([])
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [pendingFocusNodeId, setPendingFocusNodeId] = useState<string | null>(null)
  const [pendingFocusFlowKey, setPendingFocusFlowKey] = useState<string | null>(null)
  const quickAddMenuRef = useRef<HTMLDivElement>(null)
  const [quickAddPlacement, setQuickAddPlacement] = useState<FloatingPlacement | null>(null)

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

  const primaryFlowKey = openFlowKeys[0] ?? rootFlowKey
  const primaryGraph = workingGraphs[primaryFlowKey]

  // Assim que os fluxos carregam pela primeira vez, mescla automaticamente todo o fecho
  // transitivo referenciado a partir da raiz — "o fluxo completo" aparece de cara, sem precisar
  // clicar em cada portal. Só roda uma vez (hasAutoMerged); depois disso, focar/mesclar/fechar
  // fica inteiramente sob controle do usuário.
  useEffect(() => {
    if (!graphs || hasAutoMerged) return
    setOpenFlowKeys(mergedFlowKeysFrom(rootFlowKey, graphs))
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
      for (const key of openFlowKeys) {
        if (!next[key] && graphs[key]) {
          next[key] = graphs[key]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [graphs, openFlowKeys])

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
    for (const key of openFlowKeys) {
      const graph = workingGraphs[key]
      if (graph) map[key] = validateGraph(graph, labels.validation)
    }
    return map
  }, [openFlowKeys, workingGraphs, labels])

  const errorCount = Object.values(issuesByFlow).reduce(
    (sum, list) => sum + list.filter((issue) => issue.severity === 'error').length,
    0,
  )
  const warningCount = Object.values(issuesByFlow).reduce(
    (sum, list) => sum + list.filter((issue) => issue.severity === 'warning').length,
    0,
  )
  const dirtyKeys = openFlowKeys.filter(isFlowDirty)
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
      const others = openFlowKeys.filter((each) => each !== key)
      if (others.some(isFlowDirty) && !window.confirm(labels.workspace.unsavedChangesConfirm)) return
      setOpenFlowKeys(graphs ? mergedFlowKeysFrom(key, graphs) : [key])
      if (editingRef && editingRef.flowKey !== key) setEditingRef(null)
      // Trocar o fluxo primário não movia a câmera: a aba acendia, o canvas continuava onde
      // estava e o fluxo escolhido ficava fora da tela — clicar em "Consórcio" parecia não fazer
      // nada. O enquadramento espera os cards existirem (ver o efeito abaixo).
      setPendingFocusFlowKey(key)
    },
    [openFlowKeys, isFlowDirty, editingRef, graphs, labels],
  )

  // "Fechar": remove um fluxo mesclado sem trocar o foco do primário.
  const closeFlow = useCallback(
    (key: string) => {
      if (isFlowDirty(key) && !window.confirm(labels.workspace.unsavedChangesConfirm)) return
      setOpenFlowKeys((prev) => prev.filter((each) => each !== key))
      setWorkingGraphs((prev) => {
        const { [key]: _removed, ...rest } = prev
        return rest
      })
      if (editingRef?.flowKey === key) setEditingRef(null)
    },
    [isFlowDirty, editingRef, labels],
  )

  /**
   * Fusão editável: traz os nós de verdade do fluxo alvo para o mesmo canvas, no lugar do portal.
   *
   * Não calcula posição. Abrir um segundo fluxo liga o layout mesclado, que posiciona TODOS os nós
   * junto e em coordenadas absolutas — um deslocamento calculado aqui seria descartado no desenho e
   * ainda assim subtraído ao gravar, que era como a posição do card ia parar errada no grafo.
   */
  const mergeFlow = useCallback((targetFlowKey: string) => {
    setOpenFlowKeys((prev) => (prev.includes(targetFlowKey) ? prev : [...prev, targetFlowKey]))
  }, [])

  // Mais de um fluxo aberto = layout global (ignora node.position individual, recalcula tudo
  // junto pra nunca sobrepor); um só fluxo aberto = comportamento de sempre (respeita posição
  // salva/arrastada, com fallback pro auto-layout daquele fluxo isolado).
  const isMerged = openFlowKeys.length > 1
  const mergedPositions = useMemo(
    () => (isMerged ? computeMergedLayout({ openKeys: openFlowKeys, graphs: workingGraphs, primaryFlowKey }) : null),
    [isMerged, openFlowKeys, workingGraphs, primaryFlowKey],
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
    for (const flowKey of openFlowKeys) {
      const graph = workingGraphs[flowKey]
      if (!graph) continue
      const fallbackPositions = mergedPositions ? {} : computeAutoLayout(graph)
      const liveCounts = countLiveByNode({ flowKey, rootFlowKey, positions: livePositions })
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
          const nsId = namespaceNodeId(flowKey, nodeId)
          return renderedPositionsRef.current.get(nsId) ?? mergedPositions.get(nsId) ?? { x: 0, y: 0 }
        }
        // Fluxo sozinho no canvas: a posição salva no grafo é a do card, sem tradução no meio.
        //
        // O `renderedPositionsRef` no meio é o que impede o card de sumir ao desligar um fio. Nó
        // vindo do seed não tem posição salva, então quem manda nele é o auto-layout — e o
        // auto-layout joga todo nó sem ligação de entrada para uma faixa ABAIXO de tudo. Desligar
        // a última ação a mandava para fora da área visível no mesmo instante, o que se lê como
        // "o editor apagou meu card". Congelando o lugar em que ele já foi desenhado, desligar o
        // fio passa a mudar só o fio.
        const nsId = namespaceNodeId(flowKey, nodeId)
        return (
          graph!.nodes[nodeId]?.position ??
          renderedPositionsRef.current.get(nsId) ??
          fallbackPositions[nodeId] ?? { x: 0, y: 0 }
        )
      }

      for (const node of Object.values(graph.nodes)) {
        const position = resolvePosition(node.id)
        allNodes.push({
          id: namespaceNodeId(flowKey, node.id),
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
            onQuickAdd: ({ nodeId, handle, anchor }) => setQuickAddFrom({ flowKey, nodeId, handle, anchor }),
          } satisfies FlowNodeCardData,
        })

        // Um portal por (nó de origem, fluxo alvo único) — só para saltos cujo fluxo alvo AINDA
        // não está mesclado no canvas (hoje raro, já que abrir um fluxo já mescla tudo que ele
        // referencia — mas serve de rede de segurança pra um fluxo criado depois da fusão
        // inicial); se já estiver mesclado, buildAllEdges liga direto ao nó real.
        const crossFlowTargets = [...new Set(targetsOf(node).map((edge) => edge.target).filter(isCrossFlowTarget))]
        crossFlowTargets.forEach((target, index) => {
          const targetFlowKey = crossFlowKey(target)
          if (openFlowKeys.includes(targetFlowKey)) return
          allNodes.push({
            id: namespaceNodeId(flowKey, portalNodeId(node.id, target)),
            type: 'flowPortal',
            draggable: false,
            selectable: false,
            position: { x: position.x + 320, y: position.y + index * 70 },
            data: {
              label: graphs?.[targetFlowKey]?.label ?? targetFlowKey,
              onNavigate: () => mergeFlow(targetFlowKey),
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
          id: namespaceNodeId(flowKey, `__chain__${chain.actionNodeId}`),
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
          id: namespaceNodeId(flowKey, '__group_header__'),
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
    openFlowKeys,
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

  // Desligar um fio é gravar destino vazio no nó de origem — o nó do outro lado NÃO se mexe. Era
  // isso que faltava: sem caminho para desligar, trocar o destino da última ação passava por
  // apagar o card e refazê-lo.
  const disconnectEdge = useCallback(
    (spec: FlowEdgeSpec) => {
      const { flowKey, nodeId } = parseNamespacedId(spec.source)
      updateFlow(flowKey, (graph) => {
        const node = graph.nodes[nodeId]
        if (!node) return graph
        return { ...graph, nodes: { ...graph.nodes, [nodeId]: clearConnection(node, spec.sourceHandle ?? 'next') } }
      })
    },
    [updateFlow],
  )

  const edges = useMemo(
    () =>
      buildFlowEdges({ openKeys: openFlowKeys, graphs: workingGraphs, rootFlowKey, livePositions }).map((spec) =>
        // Salto entre fluxos desenhado como portal não se desliga daqui: quem manda nele é o `next`
        // do nó de origem, e o portal é só a caixa que representa o fluxo alvo ausente.
        styleEdge(spec, { disconnectLabel: labels.quickAdd.disconnect, onDisconnect: disconnectEdge }),
      ),
    [openFlowKeys, workingGraphs, rootFlowKey, livePositions, labels, disconnectEdge],
  )

  // Arrastar a ponta de um fio para outro card: religa em UMA edição, sem passar por um estado
  // intermediário em que o fluxo está quebrado.
  const onReconnect = useCallback(
    (oldEdge: Edge, connection: Connection) => {
      const resolved = resolveConnection({
        connection: {
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle ?? oldEdge.sourceHandle,
        },
        graphs: workingGraphs,
      })
      if (!resolved) return

      updateFlow(resolved.flowKey, (graph) => {
        const node = graph.nodes[resolved.nodeId]
        if (!node) return graph
        return { ...graph, nodes: { ...graph.nodes, [resolved.nodeId]: applyConnection(node, resolved) } }
      })
    },
    [workingGraphs, updateFlow],
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

  // Enquadra o fluxo recém-focado. `fitView` restrito aos cards DELE, e não o `fitView` geral:
  // o canvas mostra o fecho transitivo inteiro, e enquadrar tudo devolveria a mesma visão de
  // sempre. `maxZoom` evita que um fluxo de dois nós encha a tela.
  useEffect(() => {
    if (!pendingFocusFlowKey || !flowInstance) return
    const flowNodes = rfNodes.filter((node) => parseNamespacedId(node.id).flowKey === pendingFocusFlowKey)
    if (flowNodes.length === 0) return
    void flowInstance.fitView({
      nodes: flowNodes.map((node) => ({ id: node.id })),
      maxZoom: FOCUS_MAX_ZOOM,
      padding: FOCUS_PADDING,
      duration: FOCUS_DURATION_MS,
    })
    setPendingFocusFlowKey(null)
  }, [pendingFocusFlowKey, flowInstance, rfNodes])

  // O menu do "+" saía da tela quando o card estava perto da borda: a âncora era usada crua, sem
  // consultar o tamanho da janela. Mede depois de montar e reposiciona antes da pintura.
  useLayoutEffect(() => {
    if (!quickAddFrom) {
      setQuickAddPlacement(null)
      return
    }
    const panel = quickAddMenuRef.current
    if (!panel) return
    const { x, y } = quickAddFrom.anchor
    setQuickAddPlacement(
      placeFloatingPanel({
        anchor: { left: x, top: y, right: x, bottom: y },
        panel: { width: panel.offsetWidth, height: panel.scrollHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        prefer: 'below',
        gap: QUICK_ADD_MENU_GAP,
      }),
    )
  }, [quickAddFrom])

  const quickAddMenuStyle = {
    left: quickAddPlacement?.left ?? 0,
    top: quickAddPlacement?.top ?? 0,
    maxHeight: quickAddPlacement?.maxHeight,
    overflowY: 'auto' as const,
    visibility: quickAddPlacement ? ('visible' as const) : ('hidden' as const),
  }

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((current) => applyNodeChanges(changes, current))
  }, [])

  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      renderedPositionsRef.current.set(node.id, node.position)
      const { flowKey, nodeId } = parseNamespacedId(node.id)
      if (!openFlowKeys.includes(flowKey)) return

      // A posição do card É a posição do grafo: não há mais deslocamento por fluxo a desfazer aqui.
      updateFlow(flowKey, (graph) =>
        graph.nodes[nodeId]
          ? { ...graph, nodes: { ...graph.nodes, [nodeId]: { ...graph.nodes[nodeId]!, position: node.position } } }
          : graph,
      )
    },
    [openFlowKeys, updateFlow],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      // Traduzir o arraste e aplicar no nó são as duas decisões que mandam a conversa do cliente
      // para o lugar certo ou errado, sem erro no meio — por isso vivem em `flowEditorOps`, testadas.
      const resolved = resolveConnection({
        connection: { source: connection.source, target: connection.target, sourceHandle: connection.sourceHandle },
        graphs: workingGraphs,
      })
      if (!resolved) return

      updateFlow(resolved.flowKey, (graph) => {
        const node = graph.nodes[resolved.nodeId]
        if (!node) return graph
        return { ...graph, nodes: { ...graph.nodes, [resolved.nodeId]: applyConnection(node, resolved) } }
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
    setPendingFocusNodeId(namespaceNodeId(primaryFlowKey, newNode.id))
  }

  /**
   * Cria o próximo nó e liga o fio na MESMA edição.
   *
   * Uma edição só, e não duas, porque o desfazer é por passo: criar e ligar separados fariam um
   * "desfazer" deixar o card novo solto no canvas, que é justamente o estado que ninguém quer.
   * A posição sai do card de origem, à direita dele — o nó nasce onde a pessoa estava olhando,
   * em vez de na faixa de órfãos abaixo de tudo.
   */
  function handleQuickAdd(spec: NewNodeSpec) {
    const origin = quickAddFrom
    setQuickAddFrom(null)
    if (!origin) return

    const originGraph = workingGraphs[origin.flowKey]
    if (!originGraph) return

    const newNode = newNodeFromSpec(spec, new Set(Object.keys(originGraph.nodes)))
    const originPosition =
      renderedPositionsRef.current.get(namespaceNodeId(origin.flowKey, origin.nodeId)) ??
      originGraph.nodes[origin.nodeId]?.position ?? { x: 0, y: 0 }
    // À direita de quem criou, e descendo se aquele lugar já tiver dono — tipicamente o próprio nó
    // que acabou de perder a ligação, que é exatamente quem está naquela coluna.
    const taken = openFlowKeys.flatMap((key) =>
      Object.entries(workingGraphs[key]?.nodes ?? {}).map(
        ([id, node]) => renderedPositionsRef.current.get(namespaceNodeId(key, id)) ?? node.position ?? { x: 0, y: 0 },
      ),
    )
    newNode.position = findFreeSlot({
      desired: { x: originPosition.x + QUICK_ADD_COLUMN_GAP, y: originPosition.y },
      taken,
    })
    // Com fluxos mesclados quem decide o lugar é o layout, não o `position` do nó — sem semear
    // aqui, o card nascia na coluna calculada, em cima do nó que acabou de ficar solto.
    renderedPositionsRef.current.set(namespaceNodeId(origin.flowKey, newNode.id), newNode.position)

    updateFlow(origin.flowKey, (graph) => {
      const sourceNode = graph.nodes[origin.nodeId]
      if (!sourceNode) return graph
      const connected = applyConnection(sourceNode, {
        flowKey: origin.flowKey,
        nodeId: origin.nodeId,
        handle: origin.handle,
        targetValue: newNode.id,
      })
      return { ...graph, nodes: { ...graph.nodes, [origin.nodeId]: connected, [newNode.id]: newNode } }
    })

    setEditingRef({ flowKey: origin.flowKey, nodeId: newNode.id })
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
      setOpenFlowKeys([newFlow.key])
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
      setOpenFlowKeys(reloaded ? mergedFlowKeysFrom(rootFlowKey, reloaded) : [rootFlowKey])
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
      <TooltipLayer />
      <div className="flex items-center justify-between flex-wrap gap-3">
        {showHeader && (
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{labels.workspace.title}</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{labels.workspace.subtitle}</p>
          </div>
        )}
        {/* Quatro botões passam de 580px e a tela mais estreita é de 375px: sem `flex-wrap` a barra
            empurrava a página inteira para o lado. `ml-auto` mantém tudo à direita mesmo sem o
            título ao lado, que é o caso de `showHeader={false}`. */}
        <div className="flex flex-wrap items-center justify-end gap-3 ml-auto">
          {saveState === 'success' && <span className="text-sm text-green-600">{labels.workspace.saveSuccess}</span>}
          {saveState === 'error' && (
            <span className="text-sm text-red-600">{saveErrorMessage ?? labels.workspace.saveError}</span>
          )}
          <button
            data-cv-tooltip={viewMode === 'map' ? labels.flowMap.toggleToDetail : labels.flowMap.toggleToMap} aria-label={viewMode === 'map' ? labels.flowMap.toggleToDetail : labels.flowMap.toggleToMap}
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
                data-cv-tooltip={labels.workspace.organizeTooltip} aria-label={labels.workspace.organizeTooltip}
                disabled={!primaryGraph}
              >
                <LayoutGrid size={14} aria-hidden="true" /> {labels.workspace.organize}
              </button>
              <button
                type="button"
                onClick={handleDiscardChanges}
                className={OUTLINE_BUTTON}
                data-cv-tooltip={labels.workspace.discardTooltip} aria-label={labels.workspace.discardTooltip}
                disabled={!isDirty || saveState === 'saving'}
              >
                <Undo2 size={14} aria-hidden="true" /> {labels.workspace.discardChanges}
              </button>
              <button
                data-cv-tooltip={labels.workspace.saveGraph} aria-label={labels.workspace.saveGraph}
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
                  data-cv-tooltip={graph.label} aria-label={graph.label}
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
                data-cv-tooltip={labels.flowManager.newFlow} aria-label={labels.flowManager.newFlow}
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
                data-cv-tooltip={labels.flowManager.deleteFlow} aria-label={labels.flowManager.deleteFlow}
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
            edgeTypes={flowEdgeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onInit={setFlowInstance}
            fitView
            proOptions={{ hideAttribution: true }}
            colorMode={isDark ? 'dark' : 'light'}
          >
            <Background color={isDark ? BACKGROUND_COLOR_DARK : BACKGROUND_COLOR_LIGHT} />
            <Controls />
            <Panel position="top-right">
              <FlowLegend
                labels={labels}
                edgeSamples={legendEdgeSamples(labels)}
                nodeSwatches={LEGEND_NODE_SWATCHES}
              />
            </Panel>
            <MiniMap pannable zoomable className="!bg-white dark:!bg-gray-800" />
          </ReactFlow>
        )}
      </div>

      {/* Menu do "+": ancorado no ponto clicado e em coordenadas de tela (`fixed`), porque o canvas
          tem pan e zoom próprios — posicionar dentro dele faria o menu escorregar junto. */}
      {quickAddFrom && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setQuickAddFrom(null)} />
          <div
            ref={quickAddMenuRef}
            className="fixed z-50 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1"
            style={quickAddMenuStyle}
          >
            <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {labels.quickAdd.title}
            </p>
            <FlowPaletteMenu
              onSelect={handleQuickAdd}
              labels={labels}
              {...(actionOptions ? { actionOptions: [...actionOptions] } : {})}
            />
          </div>
        </>
      )}

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
            <button data-cv-tooltip={labels.nodePanel.cancel} aria-label={labels.nodePanel.cancel} type="button" className={OUTLINE_BUTTON} onClick={() => setShowCreateDialog(false)}>
              {labels.nodePanel.cancel}
            </button>
            <button
              data-cv-tooltip={labels.flowManager.create} aria-label={labels.flowManager.create}
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
            <button data-cv-tooltip={labels.nodePanel.cancel} aria-label={labels.nodePanel.cancel} type="button" className={OUTLINE_BUTTON} onClick={() => setShowDeleteDialog(false)}>
              {labels.nodePanel.cancel}
            </button>
            <button
              data-cv-tooltip={labels.flowManager.deleteFlow} aria-label={labels.flowManager.deleteFlow}
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
