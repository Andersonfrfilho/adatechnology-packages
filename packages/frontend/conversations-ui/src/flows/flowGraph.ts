// Os TIPOS do grafo vêm de meta-whatsapp-contracts — é a fonte única da verdade do trio
// (ver rules/packages/pluggable-module.md §2). Mantê-los duplicados aqui já tinha causado drift
// real: o backend ganhou `FlowGraphData.version` e este pacote não, sem nada quebrar em
// compile-time. `import type` puro: nenhum runtime do contracts entra no bundle do frontend.
// O que fica local neste arquivo é só o que é de UI/layout (posicionamento, validação de
// publicação, limites de renderização do WhatsApp) — isso não pertence ao contrato.
import type {
  FlowNodeType,
  FlowQuestionType,
  FlowActionKind,
  FlowConditionOperator,
  FlowNodeNext,
  FlowNodeData,
  FlowGraphData,
} from '@adatechnology/meta-whatsapp-contracts'
import { FLOW_ACTION_KIND } from '@adatechnology/meta-whatsapp-contracts'

export type {
  FlowNodeType,
  FlowQuestionType,
  FlowActionKind,
  FlowConditionOperator,
  FlowNodeNext,
  FlowNodeData,
  FlowGraphData,
}

export const CONDITION_OPERATORS: FlowConditionOperator[] = ['>', '>=', '<', '<=', '==', '!=', 'contains']

// Kinds de ação genéricos que o pacote conhece de fábrica — o host pode registrar quaisquer
// outros via `actionKindLabels`/`actionKinds` nos componentes (ver FlowPalette, labels.ts).
// Reexporta o vocabulário do contrato em vez de redeclarar os literais: o editor oferece na
// paleta exatamente os `actionKind` que o backend sabe interpretar, e duas listas separadas
// divergiriam em silêncio (um nó publicável que nenhum handler atende).
export const BUILT_IN_ACTION_KINDS = FLOW_ACTION_KIND

// Destinos "flow:<key>" são saltos para outro fluxo, resolvidos pelo motor do host. Duplicado
// (em vez de importado do contracts) de propósito: são três linhas triviais e importá-las como
// valor puxaria o runtime do contracts para o bundle do frontend só por causa disso. O contracts
// exporta as mesmas funções para o backend; a convenção "flow:" é o contrato de fato.
/**
 * Ações depois das quais a conversa CONTINUA no grafo, em vez de terminar.
 *
 * A distinção não é estética: o motor do bot só anda para o `next` depois de `send_media` — as
 * demais ações (handoff, encerrar, simular, catálogo) encerram o passo ali. Dar saída a uma ação
 * que o motor não atravessa desenharia um fio que o bot ignora em produção, deixando a conversa
 * parada sem ninguém entender por quê — o mesmo erro que `resolveConnection` recusa cometer.
 */
export const PASS_THROUGH_ACTION_KINDS: readonly string[] = ['send_media']

export const CROSS_FLOW_PREFIX = 'flow:'
export const isCrossFlowTarget = (target: string): boolean => target.startsWith(CROSS_FLOW_PREFIX)
export const crossFlowKey = (target: string): string => target.slice(CROSS_FLOW_PREFIX.length)

// Card tem largura fixa (w-60 do Tailwind = 240px); a altura varia com o número de linhas de
// saída (uma por opção/condição), então o layout precisa saber isso pra não deixar a camada de
// baixo grudada/sobreposta num card mais alto (ex.: um menu com 7 opções é bem mais alto que
// uma pergunta linear de "Próximo" só).
export const NODE_CARD_WIDTH = 240
export function estimateNodeHeight(node: FlowNodeData): number {
  const HEADER_HEIGHT = 28
  const BODY_HEIGHT = 56
  const PADDING = 16
  const ROW_HEIGHT = 34
  const rowCount =
    node.type === 'action'
      ? // Ação de passagem desenha uma linha de saída; terminal não desenha nenhuma.
        node.actionKind && PASS_THROUGH_ACTION_KINDS.includes(node.actionKind)
        ? 1
        : 0
      : node.type === 'condition'
        ? 2
        : node.type === 'menu' || node.questionType === 'choice'
          ? (node.options?.length ?? 0) + 1
          : 1
  return HEADER_HEIGHT + BODY_HEIGHT + PADDING + rowCount * ROW_HEIGHT
}

// Limites reais da API do WhatsApp para mensagens interativas: até 3 opções o bot envia
// BOTÕES (título ≤ 20 chars); com 4+ envia LISTA (até 10 itens, título ≤ 24 chars).
export const WHATSAPP_LIMITS = {
  MAX_BUTTONS: 3,
  MAX_LIST_ROWS: 10,
  BUTTON_TITLE_MAX: 20,
  LIST_ROW_TITLE_MAX: 24,
  BODY_MAX: 1024,
} as const

export function rendersAsButtons(options: [string, string][] | undefined): boolean {
  return (options?.length ?? 0) <= WHATSAPP_LIMITS.MAX_BUTTONS
}

export function targetsOf(node: FlowNodeData): { target: string; optionId?: string; isDefault?: boolean }[] {
  if (!node.next) return []
  if (typeof node.next === 'string') return [{ target: node.next }]
  return [
    ...Object.entries(node.next.byAnswer).map(([optionId, target]) => ({ target, optionId })),
    { target: node.next.default, isDefault: true },
  ]
}

export type GraphIssue = {
  severity: 'error' | 'warning'
  nodeId?: string
  message: string
}

// Validação de publicação: salvar já é publicar (o host lê o grafo em tempo real), então
// erros bloqueiam o salvamento; avisos só orientam.
export function validateGraph(
  graph: FlowGraphData,
  issueText: {
    noStart: string
    brokenRef: (from: string, to: string) => string
    choiceWithoutOptions: (id: string) => string
    duplicatedOptionId: (id: string, optionId: string) => string
    optionWithoutTarget: (id: string, optionLabel: string) => string
    tooManyOptions: (id: string, count: number) => string
    buttonTitleTooLong: (id: string, label: string) => string
    listTitleTooLong: (id: string, label: string) => string
    bodyTooLong: (id: string) => string
    unreachable: (id: string) => string
    deadEndQuestion: (id: string) => string
    conditionIncomplete: (id: string) => string
    conditionBranchMissing: (id: string, branch: string) => string
  },
): GraphIssue[] {
  const issues: GraphIssue[] = []
  const nodeIds = new Set(Object.keys(graph.nodes))
  const isValidTarget = (target: string) => nodeIds.has(target) || isCrossFlowTarget(target)

  if (!nodeIds.has(graph.startNodeId)) {
    issues.push({ severity: 'error', message: issueText.noStart })
  }

  for (const node of Object.values(graph.nodes)) {
    for (const { target } of targetsOf(node)) {
      if (!isValidTarget(target)) {
        issues.push({ severity: 'error', nodeId: node.id, message: issueText.brokenRef(node.id, target) })
      }
    }

    const isChoice = node.questionType === 'choice' || node.type === 'menu'
    if (isChoice) {
      const options = node.options ?? []
      if (options.length === 0) {
        issues.push({ severity: 'error', nodeId: node.id, message: issueText.choiceWithoutOptions(node.id) })
      }
      const seen = new Set<string>()
      for (const [optionId, label] of options) {
        if (seen.has(optionId)) {
          issues.push({ severity: 'error', nodeId: node.id, message: issueText.duplicatedOptionId(node.id, optionId) })
        }
        seen.add(optionId)
        const byAnswer = typeof node.next === 'object' && node.next ? node.next.byAnswer : {}
        if (!byAnswer[optionId]) {
          issues.push({ severity: 'warning', nodeId: node.id, message: issueText.optionWithoutTarget(node.id, label) })
        }
        const usesButtons = rendersAsButtons(options)
        if (usesButtons && label.length > WHATSAPP_LIMITS.BUTTON_TITLE_MAX) {
          issues.push({ severity: 'error', nodeId: node.id, message: issueText.buttonTitleTooLong(node.id, label) })
        }
        if (!usesButtons && label.length > WHATSAPP_LIMITS.LIST_ROW_TITLE_MAX) {
          issues.push({ severity: 'error', nodeId: node.id, message: issueText.listTitleTooLong(node.id, label) })
        }
      }
      if (options.length > WHATSAPP_LIMITS.MAX_LIST_ROWS) {
        issues.push({ severity: 'error', nodeId: node.id, message: issueText.tooManyOptions(node.id, options.length) })
      }
    }

    const bodyText = node.question ?? node.directMessage ?? ''
    if (bodyText.length > WHATSAPP_LIMITS.BODY_MAX) {
      issues.push({ severity: 'error', nodeId: node.id, message: issueText.bodyTooLong(node.id) })
    }

    if (node.type === 'question' && !node.next) {
      issues.push({ severity: 'warning', nodeId: node.id, message: issueText.deadEndQuestion(node.id) })
    }

    if (node.type === 'condition') {
      if (!node.conditionContextKey || !node.conditionOperator || !node.conditionValue) {
        issues.push({ severity: 'error', nodeId: node.id, message: issueText.conditionIncomplete(node.id) })
      }
      const byAnswer = typeof node.next === 'object' && node.next ? node.next.byAnswer : {}
      if (!byAnswer.true)
        issues.push({
          severity: 'warning',
          nodeId: node.id,
          message: issueText.conditionBranchMissing(node.id, 'true'),
        })
      if (!byAnswer.false)
        issues.push({
          severity: 'warning',
          nodeId: node.id,
          message: issueText.conditionBranchMissing(node.id, 'false'),
        })
    }
  }

  for (const id of findUnreachable(graph)) {
    issues.push({ severity: 'warning', nodeId: id, message: issueText.unreachable(id) })
  }

  return issues
}

function findUnreachable(graph: FlowGraphData): string[] {
  const reachable = new Set<string>()
  const queue = [graph.startNodeId]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (reachable.has(id) || !graph.nodes[id]) continue
    reachable.add(id)
    for (const { target } of targetsOf(graph.nodes[id])) {
      if (!isCrossFlowTarget(target)) queue.push(target)
    }
  }
  return Object.keys(graph.nodes).filter((id) => !reachable.has(id))
}

/** Distância horizontal entre um card e o seguinte na cascata. */
export const LAYOUT_COLUMN_GAP = 300
/** Folga vertical entre um card e o de baixo, somada à altura real do de cima. */
export const LAYOUT_ROW_GAP = 40

/**
 * Ordem de leitura do grafo: profundidade primeiro, seguindo as saídas na ordem em que o card as
 * mostra.
 *
 * Profundidade, e não largura, porque é ela que mantém um caminho de conversa junto na tela — com
 * BFS, os dois ramos de uma decisão se intercalam linha a linha e o olho perde qual leva a qual.
 */
export function cascadeOrder(params: {
  readonly rootId: string
  readonly allIds: readonly string[]
  readonly forwardEdges: (id: string) => readonly string[]
}): Map<string, { depth: number; order: number }> {
  const placed = new Map<string, { depth: number; order: number }>()

  function visit(id: string, depth: number): void {
    if (placed.has(id)) return
    placed.set(id, { depth, order: placed.size })
    for (const next of params.forwardEdges(id)) visit(next, depth + 1)
  }

  if (params.allIds.includes(params.rootId)) visit(params.rootId, 0)

  // Órfãos entram depois, todos na mesma coluna extra: uma coluna por órfão empurrava cada um para
  // mais longe da área visível, e desligar um fio se lia como "o card sumiu".
  const strayDepth = Math.max(0, ...[...placed.values()].map((each) => each.depth)) + 1
  for (const id of params.allIds) {
    if (!placed.has(id)) placed.set(id, { depth: strayDepth, order: placed.size })
  }

  return placed
}

/**
 * Auto-layout em cascata: avança para a direita a cada passo do fluxo e desce a cada card.
 *
 * **Um card por linha, sempre.** Empilhar por camada — todos do mesmo nível na mesma coluna, todas
 * as colunas começando na mesma altura — deixava os fios correndo na horizontal, e um fio horizontal
 * passa por trás de qualquer card que esteja entre a origem e o destino. Descendo um degrau por
 * card, toda ligação vira uma diagonal curta e visível, e o caminho da conversa se lê de cima para
 * baixo enquanto avança da esquerda para a direita.
 */
export function computeAutoLayout(graph: FlowGraphData): Record<string, { x: number; y: number }> {
  const placed = cascadeOrder({
    rootId: graph.startNodeId,
    allIds: Object.keys(graph.nodes),
    forwardEdges: (id) =>
      targetsOf(graph.nodes[id] ?? { id, type: 'action' })
        .map((edge) => edge.target)
        .filter((target) => !isCrossFlowTarget(target) && Boolean(graph.nodes[target])),
  })

  const byOrder = [...placed.entries()].sort((a, b) => a[1].order - b[1].order)
  const positions: Record<string, { x: number; y: number }> = {}
  let cursorY = 0

  for (const [id, { depth }] of byOrder) {
    positions[id] = { x: depth * LAYOUT_COLUMN_GAP, y: cursorY }
    cursorY += estimateNodeHeight(graph.nodes[id]!) + LAYOUT_ROW_GAP
  }

  return positions
}

// Chaves de fluxo (sem duplicatas) que este fluxo referencia via "flow:<key>" — usado tanto pro
// mapa de fluxos (visão hierárquica) quanto pra decidir, na fusão editável, se um salto já
// mesclado no canvas deve virar ligação real ou continuar como portal.
export function crossFlowTargetsOf(graph: FlowGraphData): string[] {
  const keys = new Set<string>()
  for (const node of Object.values(graph.nodes)) {
    for (const { target } of targetsOf(node)) {
      if (isCrossFlowTarget(target)) keys.add(crossFlowKey(target))
    }
  }
  return [...keys]
}

// Auto-layout do MAPA de fluxos: mesma ideia do computeAutoLayout, mas em granularidade de
// fluxo inteiro (cada fluxo é "um nó"), ranqueado por BFS a partir do fluxo raiz (normalmente
// o menu principal) usando crossFlowTargetsOf como as arestas.
export function computeFlowMapLayout(
  graphs: Record<string, FlowGraphData>,
  rootKey: string,
): Record<string, { x: number; y: number }> {
  const H_GAP = 280
  const V_GAP = 170
  const rank: Record<string, number> = {}
  const queue: string[] = graphs[rootKey] ? [rootKey] : Object.keys(graphs)
  if (graphs[rootKey]) rank[rootKey] = 0

  while (queue.length > 0) {
    const key = queue.shift()!
    const g = graphs[key]
    if (!g) continue
    for (const target of crossFlowTargetsOf(g)) {
      if (!graphs[target]) continue
      if (rank[target] === undefined) {
        rank[target] = rank[key]! + 1
        queue.push(target)
      }
    }
  }

  const maxRank = Math.max(0, ...Object.values(rank))
  let strayRank = maxRank + 1
  for (const key of Object.keys(graphs)) {
    if (rank[key] === undefined) rank[key] = strayRank++
  }

  const layers: Record<number, string[]> = {}
  for (const [key, r] of Object.entries(rank)) {
    layers[r] = [...(layers[r] ?? []), key]
  }

  const positions: Record<string, { x: number; y: number }> = {}
  for (const [r, keys] of Object.entries(layers)) {
    const width = (keys.length - 1) * H_GAP
    keys.forEach((key, index) => {
      positions[key] = { x: index * H_GAP - width / 2, y: Number(r) * V_GAP }
    })
  }
  return positions
}

export type CollectionChain = { nodeIds: string[]; actionNodeId: string }

// Detecta o conjunto de perguntas que alimentam EXCLUSIVAMENTE um nó de ação — inclui
// perguntas de escolha (ex.: "Possui mais de 3 anos de FGTS? Sim/Não") desde que TODOS os
// ramos dela convirjam pra essa mesma ação, não só perguntas lineares numa fila reta. Puramente
// derivado da topologia do grafo (não é um dado novo persistido) — usado só pra desenhar uma
// moldura visual ("essas N perguntas alimentam essa ação").
export function findCollectionChains(graph: FlowGraphData): CollectionChain[] {
  const actionIds = new Set(
    Object.values(graph.nodes)
      .filter((n) => n.type === 'action')
      .map((n) => n.id),
  )
  const memo = new Map<string, Set<string>>()

  // Quais ações (nenhuma, uma ou várias) são alcançáveis a partir deste nó, seguindo só
  // ligações dentro do próprio fluxo (saltos flow:<key> não contam — pertencem a outro fluxo).
  function reachableActions(id: string, stack: Set<string>): Set<string> {
    if (memo.has(id)) return memo.get(id)!
    if (stack.has(id)) return new Set()
    if (actionIds.has(id)) return new Set([id])
    const node = graph.nodes[id]
    if (!node) return new Set()

    const nextStack = new Set(stack)
    nextStack.add(id)
    const result = new Set<string>()
    for (const { target } of targetsOf(node)) {
      if (isCrossFlowTarget(target) || !graph.nodes[target]) continue
      for (const actionId of reachableActions(target, nextStack)) result.add(actionId)
    }
    memo.set(id, result)
    return result
  }

  const nodeIdsByAction = new Map<string, string[]>()
  for (const node of Object.values(graph.nodes)) {
    if (node.type !== 'question') continue
    const reached = reachableActions(node.id, new Set())
    if (reached.size !== 1) continue
    const [actionNodeId] = [...reached]
    nodeIdsByAction.set(actionNodeId!, [...(nodeIdsByAction.get(actionNodeId!) ?? []), node.id])
  }

  return [...nodeIdsByAction.entries()]
    .filter(([, nodeIds]) => nodeIds.length >= 2)
    .map(([actionNodeId, nodeIds]) => ({ actionNodeId, nodeIds }))
}

// Gera um id de nó único e legível a partir do rótulo (ex.: "Qual sua renda?" → "qual_sua_renda").
export function slugifyNodeId(label: string, existing: ReadonlySet<string>): string {
  const base =
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30) || 'no'
  let candidate = base
  let counter = 2
  while (existing.has(candidate)) {
    candidate = `${base}_${counter}`
    counter++
  }
  return candidate
}
