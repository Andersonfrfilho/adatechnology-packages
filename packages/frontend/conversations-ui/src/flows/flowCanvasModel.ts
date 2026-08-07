/**
 * Derivações puras do canvas do editor: posições, arestas, contagem de conversas vivas e o nó que
 * nasce de cada item da paleta.
 *
 * Viviam dentro do componente, e é ali que estava o risco. Uma aresta com destino errado não pinta
 * errado — ela leva a conversa do cliente para o lugar errado, e o sintoma aparece longe de quem
 * editou. Um card que o layout joga para fora da área visível se lê como "apaguei sem querer".
 *
 * A topologia sai daqui em forma neutra (`FlowEdgeSpec`) e o estilo fica no componente: o teste cobra
 * o que importa e roda sem navegador nem `@xyflow/react`. Cor de traço ninguém quebra sem ver.
 */

import { namespaceNodeId, parseNamespacedId } from './flowEditorOps'
import {
  NODE_CARD_WIDTH,
  crossFlowKey,
  estimateNodeHeight,
  isCrossFlowTarget,
  slugifyNodeId,
  targetsOf,
  type FlowGraphData,
  type FlowNodeData,
} from './flowGraph'
import type { NewNodeSpec } from './FlowPalette'

const COLUMN_GAP = 360
const ROW_GAP = 40
/** O rótulo da moldura é desenhado acima da borda, e precisa de espaço próprio. */
const CHAIN_LABEL_ROOM = 24

export type FlowNodePosition = { readonly x: number; readonly y: number }

/** Onde cada conversa viva está parada agora. */
export type FlowLivePosition = {
  readonly currentState: string
  readonly flow: string | null
  readonly nodeId: string | null
  readonly menuNodeId: string | null
}

/**
 * Pseudo-nó que representa um fluxo alvo ainda não mesclado no canvas.
 *
 * Um portal por (nó de origem, fluxo alvo): duas opções do mesmo nó indo para o mesmo fluxo
 * compartilham o portal, senão o card ficaria cercado de caixas idênticas.
 */
export function portalNodeId(sourceNodeId: string, target: string): string {
  return `__portal__${sourceNodeId}__${target}`
}

export function chainFrameNodeId(actionNodeId: string): string {
  return `__chain__${actionNodeId}`
}

export const GROUP_HEADER_NODE_ID = '__group_header__'

/**
 * Quantas conversas estão paradas em cada nó de um fluxo.
 *
 * A raiz é caso à parte: o servidor guarda o passo do menu em `menuNodeId`, num campo próprio, e uma
 * conversa no menu não carrega `flow`. Ler `nodeId` ali daria contagem zero na tela mais visitada do
 * editor.
 */
export function countLiveByNode(params: {
  readonly flowKey: string
  readonly rootFlowKey: string
  readonly positions: readonly FlowLivePosition[] | undefined
}): Record<string, number> {
  const { flowKey, rootFlowKey, positions } = params
  const isRoot = flowKey === rootFlowKey
  const counts: Record<string, number> = {}

  for (const position of positions ?? []) {
    if (position.flow !== flowKey && !isRoot) continue
    const nodeId = isRoot ? position.menuNodeId : position.nodeId
    if (!nodeId) continue
    counts[nodeId] = (counts[nodeId] ?? 0) + 1
  }

  return counts
}

/**
 * Um layout só para TODOS os nós de TODOS os fluxos abertos juntos.
 *
 * Posicionar cada fluxo à parte e deslocar não resolve: nada impede dois fluxos de ocuparem o mesmo
 * espaço, e a altura real de cada card é ignorada. Aqui o ranqueamento por BFS roda sobre o grafo
 * mesclado inteiro, com os saltos `flow:<key>` já resolvidos para o nó inicial do alvo.
 */
export function computeMergedLayout(params: {
  readonly openKeys: readonly string[]
  readonly graphs: Readonly<Record<string, FlowGraphData>>
  readonly primaryFlowKey: string
}): Map<string, FlowNodePosition> {
  const { openKeys, graphs, primaryFlowKey } = params
  const open = new Set(openKeys)

  const nodeById = new Map<string, FlowNodeData>()
  for (const key of openKeys) {
    for (const node of Object.values(graphs[key]?.nodes ?? {})) {
      nodeById.set(namespaceNodeId(key, node.id), node)
    }
  }

  function forwardEdges(flowKey: string, node: FlowNodeData): string[] {
    const result: string[] = []

    for (const { target } of targetsOf(node)) {
      if (isCrossFlowTarget(target)) {
        const targetKey = crossFlowKey(target)
        const targetGraph = open.has(targetKey) ? graphs[targetKey] : undefined
        if (targetGraph) result.push(namespaceNodeId(targetKey, targetGraph.startNodeId))
      } else if (graphs[flowKey]?.nodes[target]) {
        result.push(namespaceNodeId(flowKey, target))
      }
    }

    return result
  }

  const rank = new Map<string, number>()
  const primaryGraph = graphs[primaryFlowKey]
  const rootId = primaryGraph ? namespaceNodeId(primaryFlowKey, primaryGraph.startNodeId) : undefined

  if (rootId && nodeById.has(rootId)) {
    rank.set(rootId, 0)
    const queue = [rootId]
    while (queue.length > 0) {
      const id = queue.shift()!
      const node = nodeById.get(id)
      if (!node) continue
      for (const nextId of forwardEdges(parseNamespacedId(id).flowKey, node)) {
        if (!rank.has(nextId)) {
          rank.set(nextId, rank.get(id)! + 1)
          queue.push(nextId)
        }
      }
    }
  }

  // Todo nó não alcançado vai para UMA coluna extra depois de tudo. Uma coluna por órfão empurrava
  // cada um mais para longe da área visível — e desligar um fio se lia como "o card sumiu".
  const strayRank = Math.max(0, ...rank.values()) + 1
  for (const id of nodeById.keys()) {
    if (!rank.has(id)) rank.set(id, strayRank)
  }

  const layers = new Map<number, string[]>()
  for (const [id, value] of rank) {
    const layer = layers.get(value)
    if (layer) layer.push(id)
    else layers.set(value, [id])
  }

  const positions = new Map<string, FlowNodePosition>()
  for (const value of [...layers.keys()].sort((a, b) => a - b)) {
    // Alinhado pelo topo, e não centralizado: coluna centralizada saltava inteira a cada nó a mais
    // num ramo qualquer.
    let cursorY = 0
    for (const id of layers.get(value)!) {
      positions.set(id, { x: value * COLUMN_GAP, y: cursorY })
      cursorY += estimateNodeHeight(nodeById.get(id)!) + ROW_GAP
    }
  }

  return positions
}

/** Papel visual da aresta. O componente traduz em traço, cor e seta; o modelo só decide qual é. */
export type FlowEdgeKind = 'linear' | 'branch' | 'fallback'

export type FlowEdgeSpec = {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly sourceHandle?: string
  readonly kind: FlowEdgeKind
  /** Salto entre fluxos — tracejado, esteja o alvo mesclado ou num portal. */
  readonly crossFlow: boolean
  readonly live: boolean
}

/**
 * Arestas de todos os fluxos abertos.
 *
 * A regra que não é óbvia: um salto `flow:<key>` vira ligação real até o nó inicial do alvo quando
 * esse fluxo já está no canvas, e só cai no portal quando não está. Sem isso, abrir dois fluxos
 * ligados mostrava uma caixa de portal entre dois cards que já estavam ali do lado.
 */
export function buildFlowEdges(params: {
  readonly openKeys: readonly string[]
  readonly graphs: Readonly<Record<string, FlowGraphData>>
  readonly rootFlowKey: string
  readonly livePositions?: readonly FlowLivePosition[] | undefined
}): FlowEdgeSpec[] {
  const { openKeys, graphs, rootFlowKey, livePositions } = params
  const open = new Set(openKeys)
  const edges: FlowEdgeSpec[] = []

  for (const flowKey of openKeys) {
    const graph = graphs[flowKey]
    if (!graph) continue
    const liveCounts = countLiveByNode({ flowKey, rootFlowKey, positions: livePositions })

    for (const [nodeId, node] of Object.entries(graph.nodes)) {
      const live = (liveCounts[nodeId] ?? 0) > 0

      for (const { target, optionId, isDefault } of targetsOf(node)) {
        // Destino vazio é estado NORMAL, não anomalia: apagar um nó zera quem apontava para ele, e
        // `targetsOf` devolve o `default` mesmo em branco. Emitir a aresta criaria ligação para um nó
        // que não existe — o React Flow a descarta em silêncio, então o sintoma seria uma opção que
        // parece ligada e não está, com a conversa do cliente parando ali.
        if (!target) continue

        const crossFlow = isCrossFlowTarget(target)
        let targetFlowKey = flowKey
        let targetNodeId = target

        if (crossFlow) {
          const wantedKey = crossFlowKey(target)
          const targetGraph = open.has(wantedKey) ? graphs[wantedKey] : undefined
          if (targetGraph) {
            targetFlowKey = wantedKey
            targetNodeId = targetGraph.startNodeId
          } else {
            targetNodeId = portalNodeId(nodeId, target)
          }
        }

        const source = namespaceNodeId(flowKey, nodeId)
        const edgeTarget = namespaceNodeId(targetFlowKey, targetNodeId)

        if (isDefault) {
          edges.push({
            id: `${source}->${edgeTarget}-default`,
            source,
            target: edgeTarget,
            sourceHandle: '__default',
            kind: 'fallback',
            crossFlow,
            // Fallback não anima: é o caminho que ninguém escolheu, e piscar sugeria que a conversa
            // estava passando por ali.
            live: false,
          })
          continue
        }

        if (optionId === undefined) {
          edges.push({ id: `${source}->${edgeTarget}`, source, target: edgeTarget, kind: 'linear', crossFlow, live })
          continue
        }

        edges.push({
          id: `${source}->${edgeTarget}-${optionId}`,
          source,
          target: edgeTarget,
          sourceHandle: optionId,
          kind: 'branch',
          crossFlow,
          live,
        })
      }
    }
  }

  return edges
}

/** Nós de um fluxo que ninguém aponta — o card ganha contorno tracejado para cobrar a ligação. */
export function detachedNodeIds(graph: FlowGraphData): Set<string> {
  const connected = new Set<string>()
  for (const node of Object.values(graph.nodes)) {
    for (const { target } of targetsOf(node)) {
      if (!isCrossFlowTarget(target)) connected.add(target)
    }
  }

  const detached = new Set<string>()
  for (const nodeId of Object.keys(graph.nodes)) {
    if (nodeId !== graph.startNodeId && !connected.has(nodeId)) detached.add(nodeId)
  }

  return detached
}

/** Retângulo que envolve uma cadeia de coleta, em coordenadas do canvas. */
export function chainFrameBounds(params: {
  readonly nodeIds: readonly string[]
  readonly graph: FlowGraphData
  readonly positionOf: (nodeId: string) => FlowNodePosition
  readonly padding: number
}): { x: number; y: number; width: number; height: number } {
  const { nodeIds, graph, positionOf, padding } = params
  const positions = nodeIds.map(positionOf)
  const minX = Math.min(...positions.map((each) => each.x))
  const maxX = Math.max(...positions.map((each) => each.x)) + NODE_CARD_WIDTH
  const minY = Math.min(...positions.map((each) => each.y))
  const maxY = Math.max(...nodeIds.map((id, index) => positions[index]!.y + estimateNodeHeight(graph.nodes[id]!)))

  return {
    x: minX - padding,
    y: minY - padding - CHAIN_LABEL_ROOM,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2 + CHAIN_LABEL_ROOM,
  }
}

/**
 * O nó que nasce de cada item da paleta.
 *
 * `contextKey` igual ao id porque é o que o motor usa para guardar a resposta: deixá-lo vazio faria a
 * pergunta ser feita e a resposta descartada, sem erro em lugar nenhum.
 */
export function newNodeFromSpec(spec: NewNodeSpec, existingIds: ReadonlySet<string>): FlowNodeData {
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
