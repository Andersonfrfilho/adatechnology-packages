import type {
  ChannelAdapterInterface,
  ConversationSession,
  FlowActionHandler,
  FlowActionKind,
  FlowGraphData,
  FlowNodeData,
} from '@adatechnology/meta-whatsapp-contracts'
import { isCrossFlowTarget, crossFlowKey } from '@adatechnology/meta-whatsapp-contracts'

export interface FlowStepInput {
  graph: FlowGraphData
  currentNodeId: string
  userAnswer?: string
  context: Record<string, unknown>
  session: ConversationSession
  channel: ChannelAdapterInterface
}

export type FlowStepResult =
  | { kind: 'awaiting-answer'; nodeId: string; context: Record<string, unknown> }
  | { kind: 'advanced'; nodeId: string; context: Record<string, unknown> }
  | { kind: 'cross-flow'; flowKey: string; context: Record<string, unknown> }
  | { kind: 'terminal'; context: Record<string, unknown> }

function evaluateCondition(node: FlowNodeData, context: Record<string, unknown>): boolean {
  if (!node.conditionContextKey || !node.conditionOperator || !node.conditionValue) return false
  const actual = context[node.conditionContextKey]
  const expected = node.conditionValue

  switch (node.conditionOperator) {
    case '==':
      return String(actual) === expected
    case '!=':
      return String(actual) !== expected
    case 'contains':
      return typeof actual === 'string' && actual.includes(expected)
    case '>':
    case '>=':
    case '<':
    case '<=': {
      const actualNum = Number(actual)
      const expectedNum = Number(expected)
      if (Number.isNaN(actualNum) || Number.isNaN(expectedNum)) return false
      if (node.conditionOperator === '>') return actualNum > expectedNum
      if (node.conditionOperator === '>=') return actualNum >= expectedNum
      if (node.conditionOperator === '<') return actualNum < expectedNum
      return actualNum <= expectedNum
    }
    default:
      return false
  }
}

function resolveNext(node: FlowNodeData, answerId: string | undefined): string | undefined {
  if (!node.next) return undefined
  if (typeof node.next === 'string') return node.next
  if (answerId && node.next.byAnswer[answerId]) return node.next.byAnswer[answerId]
  return node.next.default
}

// T4.3 — interpreta um grafo de fluxo nó a nó. `registerFlowAction` é o único jeito de um
// `actionKind` fazer algo: o interpretador nunca conhece 'trigger_simulation' ou qualquer outro
// caso de negócio do host — ele só invoca o handler registrado (ver providers.ts,
// FlowActionRegistry) e segue o `next` que o handler devolver, se houver.
export class FlowInterpreter {
  private readonly actionHandlers = new Map<FlowActionKind, FlowActionHandler>()

  registerFlowAction(kind: FlowActionKind, handler: FlowActionHandler): void {
    this.actionHandlers.set(kind, handler)
  }

  async step(input: FlowStepInput): Promise<FlowStepResult> {
    const node = input.graph.nodes[input.currentNodeId]
    if (!node) return { kind: 'terminal', context: input.context }

    if (node.type === 'condition') {
      const branch = evaluateCondition(node, input.context) ? 'true' : 'false'
      return this.moveTo(input, resolveNext(node, branch))
    }

    if (node.type === 'action') {
      const handler = node.actionKind ? this.actionHandlers.get(node.actionKind) : undefined
      if (!handler) return { kind: 'terminal', context: input.context }

      // Runtime de uma função `void` é sempre `undefined` — cast seguro para poder encadear
      // `?.` (TS não deixa acessar propriedade num tipo `void | {...}` mesmo com optional chaining).
      const result = (await handler({ node, session: input.session, channel: input.channel })) as
        | { next?: string }
        | undefined
      const nextNodeId = result?.next ?? resolveNext(node, undefined)
      return this.moveTo(input, nextNodeId)
    }

    const isChoice = node.type === 'menu' || node.questionType === 'choice'

    // Sem resposta do usuário ainda: este é o nó atual, aguardando input — não avança.
    if (input.userAnswer === undefined) {
      return { kind: 'awaiting-answer', nodeId: input.currentNodeId, context: input.context }
    }

    const updatedContext = node.contextKey ? { ...input.context, [node.contextKey]: input.userAnswer } : input.context
    const answerId = isChoice ? input.userAnswer : undefined
    const nextNodeId = resolveNext(node, answerId)

    return this.moveTo({ ...input, context: updatedContext }, nextNodeId)
  }

  private moveTo(input: FlowStepInput, nextNodeId: string | undefined): FlowStepResult {
    if (!nextNodeId) return { kind: 'terminal', context: input.context }
    if (isCrossFlowTarget(nextNodeId))
      return { kind: 'cross-flow', flowKey: crossFlowKey(nextNodeId), context: input.context }
    if (!input.graph.nodes[nextNodeId]) return { kind: 'terminal', context: input.context }
    return { kind: 'advanced', nodeId: nextNodeId, context: input.context }
  }
}
