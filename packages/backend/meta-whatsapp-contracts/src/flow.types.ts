// Mesmo shape de dados do editor visual (@adatechnology/conversations-ui/flows) — o backend
// interpreta/persiste o grafo, o frontend edita; os dois lados precisam concordar no formato.
// `FlowActionKind` é string aberta (não union fechada): o host registra os próprios actions
// (ex.: 'trigger_simulation' no bot) via registerFlowAction() no módulo (T4.3) — o pacote nunca
// assume nenhum caso de negócio específico.
import { z } from 'zod'

export type FlowNodeType = 'question' | 'entrada_choice' | 'action' | 'menu' | 'condition'
export type FlowQuestionType = 'text' | 'money' | 'date' | 'int' | 'cpf' | 'choice'
export type FlowActionKind = string

// Os únicos `actionKind` que o próprio pacote implementa — todo o resto é do host. Ficam aqui, e
// não no editor, porque o mesmo literal é usado nos dois lados (o editor oferece na paleta, o
// módulo registra o handler) e duas cópias divergem sem nada acusar.
export const FLOW_ACTION_KIND = {
  HANDOFF: 'handoff',
  RATE_LIMITED_HANDOFF: 'rate_limited_handoff',
  SEND_PRODUCT_LIST: 'send_product_list',
  SEND_MEDIA: 'send_media',
} as const
export type FlowConditionOperator = '>' | '>=' | '<' | '<=' | '==' | '!=' | 'contains'
export type FlowNodeNext = string | { byAnswer: Record<string, string>; default: string }

// Destinos "flow:<key>" são saltos para outro fluxo — mesma convenção usada pelo editor visual
// (conversations-ui/flows/flowGraph.ts); backend e frontend precisam concordar no formato.
export const CROSS_FLOW_PREFIX = 'flow:'
export const isCrossFlowTarget = (target: string): boolean => target.startsWith(CROSS_FLOW_PREFIX)
export const crossFlowKey = (target: string): string => target.slice(CROSS_FLOW_PREFIX.length)

export type FlowNodeData = {
  id: string
  type: FlowNodeType
  contextKey?: string
  questionType?: FlowQuestionType
  question?: string
  options?: [string, string][]
  actionKind?: FlowActionKind
  // Parâmetros arbitrários que o nó carrega para o handler registrado em `actionKind`. O pacote
  // nunca os interpreta — é o que permite um nó de ação ser configurado pelo editor sem que o
  // vocabulário do produto (o antigo `simulationTemplate`) vaze para dentro do contrato.
  actionParams?: Record<string, unknown>
  directMessage?: string
  fallbackMessage?: string
  conditionContextKey?: string
  conditionOperator?: FlowConditionOperator
  conditionValue?: string
  position?: { x: number; y: number }
  next?: FlowNodeNext
}

export interface FlowGraphData {
  key: string
  label: string
  startNodeId: string
  version: number
  nodes: Record<string, FlowNodeData>
}

export interface FlowGraphSummary {
  key: string
  label: string
  nodeCount: number
  showInMenu: boolean
  menuOptionLabel?: string
  updatedAt: string
}

// Retorno de GetLiveFlowPositions (T4.2) — quantas sessões ativas estão em cada nó agora,
// usado pelo editor para desenhar o "liveCount" nos cards (FlowNodeCardData.liveCount).
export interface LiveFlowPosition {
  flowKey: string
  nodeId: string
  count: number
}

// Validação de runtime do grafo. O `nodes` é um jsonb que entrou pelo editor (dado de origem
// cliente) e sai do banco como `unknown` — sem parse, um grafo malformado só se manifestaria
// como comportamento estranho lá dentro do interpretador, longe da causa.
//
// Permissivo de propósito em dois pontos: `actionKind` é string aberta (o host registra os
// seus) e `.passthrough()` deixa passar campos extras — um grafo salvo por uma versão mais nova
// do editor não pode ficar irrecuperável numa versão mais antiga do módulo.
export const flowNodeNextSchema = z.union([
  z.string(),
  z.object({ byAnswer: z.record(z.string(), z.string()), default: z.string() }),
])

export const flowNodeDataSchema = z
  .object({
    id: z.string(),
    type: z.enum(['question', 'entrada_choice', 'action', 'menu', 'condition']),
    contextKey: z.string().optional(),
    questionType: z.enum(['text', 'money', 'date', 'int', 'cpf', 'choice']).optional(),
    question: z.string().optional(),
    options: z.array(z.tuple([z.string(), z.string()])).optional(),
    actionKind: z.string().optional(),
    actionParams: z.record(z.string(), z.unknown()).optional(),
    directMessage: z.string().optional(),
    fallbackMessage: z.string().optional(),
    conditionContextKey: z.string().optional(),
    conditionOperator: z.enum(['>', '>=', '<', '<=', '==', '!=', 'contains']).optional(),
    conditionValue: z.string().optional(),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
    next: flowNodeNextSchema.optional(),
  })
  .passthrough()

export const flowGraphNodesSchema = z.record(z.string(), flowNodeDataSchema)
