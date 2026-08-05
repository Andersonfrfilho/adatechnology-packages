/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Operações puras de grafo que o editor de fluxo precisa, e que viviam soltas dentro da página de
 * 973 linhas do financiamento.
 *
 * Puras e separadas do hook de propósito: são a parte que dá para testar sem navegador, sem React e
 * sem estado — e três delas (`removeNodeAndCleanRefs`, `resolveConnection`, `mergedFlowKeysFrom`)
 * decidem o que acontece com o fluxo que alguém desenhou. Errar ali não dá erro; dá aresta apontando
 * para nó que não existe mais, ou fluxo que some do canvas.
 */

// Os TIPOS do grafo vêm do meta-whatsapp-contracts, fonte única da verdade do trio
// (`pluggable-module.md` §2) — mesmo motivo documentado em `flowGraph.ts`. `import type` puro:
// nenhum runtime do contracts entra no bundle do frontend.
import { CROSS_FLOW_PREFIX } from '@adatechnology/meta-whatsapp-contracts'
import type { FlowGraphData, FlowNodeData, FlowNodeNext } from '@adatechnology/meta-whatsapp-contracts'

import { crossFlowTargetsOf } from './flowGraph'

const NAMESPACE_SEPARATOR = '::'

/**
 * Id de nó no canvas mesclado: vários fluxos dividem o mesmo espaço, e `boas-vindas` pode existir em
 * dois deles. Sem o prefixo, arrastar um card moveria o homônimo do outro fluxo.
 */
export function namespaceNodeId(flowKey: string, nodeId: string): string {
  return `${flowKey}${NAMESPACE_SEPARATOR}${nodeId}`
}

export function parseNamespacedId(value: string): { flowKey: string; nodeId: string } {
  const index = value.indexOf(NAMESPACE_SEPARATOR)
  // Sem separador é id de fluxo único — trata como do fluxo vazio para o chamador decidir.
  if (index === -1) return { flowKey: '', nodeId: value }
  return { flowKey: value.slice(0, index), nodeId: value.slice(index + NAMESPACE_SEPARATOR.length) }
}

/**
 * Apaga o nó E as referências a ele.
 *
 * A limpeza não é cortesia: uma aresta apontando para nó inexistente faz o motor do bot parar a
 * conversa no meio, e o sintoma aparece para o cliente, não para quem editou.
 */
export function removeNodeAndCleanRefs(
  nodes: Readonly<Record<string, FlowNodeData>>,
  removedId: string,
): Record<string, FlowNodeData> {
  const remaining: Record<string, FlowNodeData> = {}

  for (const [id, node] of Object.entries(nodes)) {
    if (id === removedId) continue
    remaining[id] = { ...node, next: cleanNext(node.next, removedId) }
  }

  return remaining
}

function cleanNext(next: FlowNodeNext | undefined, removedId: string): FlowNodeNext | undefined {
  if (next === undefined) return undefined
  if (typeof next === 'string') return next === removedId ? '' : next

  const byAnswer: Record<string, string> = {}
  for (const [answer, target] of Object.entries(next.byAnswer ?? {})) {
    // Resposta que levava ao nó apagado fica com destino vazio, e não é removida: apagar a chave
    // esconderia da tela que aquela opção existe e não vai a lugar nenhum.
    byAnswer[answer] = target === removedId ? '' : target
  }

  return { byAnswer, default: next.default === removedId ? '' : (next.default ?? '') }
}

/**
 * O fecho transitivo dos fluxos alcançáveis a partir de um — é o conjunto que o canvas abre junto.
 *
 * BFS e não recursão: fluxo que referencia a si mesmo (menu que volta ao menu) é comum, e recursão
 * ingênua estouraria a pilha no caso mais banal que existe.
 */
export function mergedFlowKeysFrom(
  rootKey: string,
  graphs: Readonly<Record<string, FlowGraphData>>,
): readonly string[] {
  const visited = new Set<string>()
  const queue = [rootKey]

  while (queue.length > 0) {
    const key = queue.shift()!
    if (visited.has(key) || !graphs[key]) continue
    visited.add(key)
    for (const target of crossFlowTargetsOf(graphs[key]!)) {
      if (!visited.has(target) && graphs[target]) queue.push(target)
    }
  }

  return [...visited]
}

export type ConnectionRequest = {
  readonly source: string
  readonly target: string
  readonly sourceHandle?: string | null | undefined
}

export type ResolvedConnection = {
  readonly flowKey: string
  readonly nodeId: string
  readonly handle: string
  /** O que gravar no `next`: id de nó local, ou `flow:<key>` quando atravessa fluxo. */
  readonly targetValue: string
}

/**
 * Traduz um arraste de aresta no valor que vai para o `next` — e recusa o que o motor do bot não
 * sabe executar.
 *
 * A regra que não é óbvia: conectar num nó de OUTRO fluxo só funciona se for o nó inicial dele,
 * porque o motor só sabe pular para o começo de um fluxo, não para um nó do meio. Conectar no meio
 * devolve `undefined` — recusa silenciosa é melhor que gravar um salto que o bot vai ignorar em
 * produção, deixando a conversa parada sem ninguém entender por quê.
 */
export function resolveConnection(params: {
  readonly connection: ConnectionRequest
  readonly graphs: Readonly<Record<string, FlowGraphData>>
}): ResolvedConnection | undefined {
  const { source, target, sourceHandle } = params.connection
  if (!source || !target || source === target) return undefined

  const sourceRef = parseNamespacedId(source)
  const targetRef = parseNamespacedId(target)

  let targetValue: string
  if (targetRef.flowKey === sourceRef.flowKey) {
    targetValue = targetRef.nodeId
  } else {
    const targetGraph = params.graphs[targetRef.flowKey]
    if (!targetGraph || targetGraph.startNodeId !== targetRef.nodeId) return undefined
    targetValue = `${CROSS_FLOW_PREFIX}${targetRef.flowKey}`
  }

  return {
    flowKey: sourceRef.flowKey,
    nodeId: sourceRef.nodeId,
    handle: sourceHandle ?? 'next',
    targetValue,
  }
}

/** Aplica a conexão resolvida no nó. `next` string para saída única, objeto para ramificação. */
export function applyConnection(node: FlowNodeData, resolved: ResolvedConnection): FlowNodeData {
  const currentNext = typeof node.next === 'object' && node.next ? node.next : undefined

  if (resolved.handle === 'next') return { ...node, next: resolved.targetValue }

  if (resolved.handle === '__default') {
    return { ...node, next: { byAnswer: currentNext?.byAnswer ?? {}, default: resolved.targetValue } }
  }

  return {
    ...node,
    next: {
      byAnswer: { ...(currentNext?.byAnswer ?? {}), [resolved.handle]: resolved.targetValue },
      default: currentNext?.default ?? '',
    },
  }
}

/**
 * Um fluxo está sujo quando o rascunho difere do publicado.
 *
 * Comparação estrutural por JSON: é grosseira, e é suficiente porque o grafo é dado serializável sem
 * ordem significativa de chave — o servidor devolve o que gravou. Comparar campo a campo daria a
 * mesma resposta com mais código para errar.
 */
export function isGraphDirty(working: FlowGraphData | undefined, published: FlowGraphData | undefined): boolean {
  if (!working || !published) return false
  return JSON.stringify(working) !== JSON.stringify(published)
}
