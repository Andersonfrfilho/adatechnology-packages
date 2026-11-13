import type {
  ChannelAdapterInterface,
  ConversationSession,
  FlowActionHandler,
  FlowActionKind,
  FlowActionResult,
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

// Resultado de run(): nunca 'advanced' (o laço já consumiu esses), mas pode ser
// 'max-steps-exceeded' quando o grafo tem um ciclo de nós automáticos.
export type FlowRunResult = (
  | { kind: 'awaiting-answer'; nodeId: string; context: Record<string, unknown> }
  | { kind: 'cross-flow'; flowKey: string; context: Record<string, unknown> }
  | { kind: 'terminal'; context: Record<string, unknown> }
  | { kind: 'max-steps-exceeded'; context: Record<string, unknown> }
) & {
  // Caminho percorrido, do nó inicial ao final — serve para depurar um ciclo (os nós repetidos
  // aparecem aqui) e para o host registrar a trilha da conversa.
  visited: string[]
  steps: number
}

const DEFAULT_MAX_STEPS = 50

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
      const result = (await handler({
        node,
        session: input.session,
        channel: input.channel,
        context: input.context,
      })) as FlowActionResult | undefined

      const contextAfterAction = result?.context ? { ...input.context, ...result.context } : input.context
      const nextNodeId = result?.next ?? resolveNext(node, undefined)
      return this.moveTo({ ...input, context: contextAfterAction }, nextNodeId)
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

  // Avança pelo grafo até parar num ponto que exige algo de fora: uma pergunta esperando resposta
  // do cliente, o fim do fluxo, ou um salto para outro fluxo. Nós de condição e ação não pedem
  // input nenhum, então parar neles obrigaria o chamador a reimplementar este laço — e sem
  // proteção, um grafo com ciclo de condições (A→B→A) o prenderia para sempre.
  //
  // O corte por `maxSteps` é uma rede de segurança de runtime, não a defesa principal: um ciclo é
  // erro de autoria e deveria ser barrado na publicação. Como validateGraph (no editor) hoje
  // detecta nó inalcançável mas NÃO detecta ciclo, um grafo cíclico é publicável — então o
  // runtime precisa sobreviver a ele em vez de travar o processo que atende o webhook.
  async run(input: FlowStepInput, options?: { maxSteps?: number }): Promise<FlowRunResult> {
    const maxSteps = options?.maxSteps ?? DEFAULT_MAX_STEPS
    const visited: string[] = [input.currentNodeId]

    let current: FlowStepInput = input
    let steps = 0

    while (steps < maxSteps) {
      const result = await this.step(current)
      steps++

      if (result.kind !== 'advanced') return { ...result, visited, steps }

      visited.push(result.nodeId)
      // Só a primeira iteração consome a resposta do cliente; daí em diante o laço percorre
      // nós automáticos (condição/ação). Manter userAnswer faria a mesma resposta ser
      // reaplicada em cada pergunta seguinte, pulando-as sem o cliente ter respondido.
      current = { ...current, currentNodeId: result.nodeId, context: result.context, userAnswer: undefined }
    }

    return { kind: 'max-steps-exceeded', context: current.context, visited, steps }
  }
}
