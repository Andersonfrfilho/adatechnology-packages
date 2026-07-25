// Mesmo shape de dados do editor visual (@adatechnology/conversations-ui/flows) — o backend
// interpreta/persiste o grafo, o frontend edita; os dois lados precisam concordar no formato.
// `FlowActionKind` é string aberta (não union fechada): o host registra os próprios actions
// (ex.: 'trigger_simulation' no bot) via registerFlowAction() no módulo (T4.3) — o pacote nunca
// assume nenhum caso de negócio específico.
export type FlowNodeType = 'question' | 'entrada_choice' | 'action' | 'menu' | 'condition'
export type FlowQuestionType = 'text' | 'money' | 'date' | 'int' | 'cpf' | 'choice'
export type FlowActionKind = string
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
  simulationTemplate?: Record<string, string>
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
