// Mesmo shape de dados do editor visual (@adatechnology/conversations-ui/flows) — o backend
// interpreta/persiste o grafo, o frontend edita; os dois lados precisam concordar no formato.
// `FlowActionKind` é string aberta (não union fechada): o host registra os próprios actions
// (ex.: 'trigger_simulation' no bot) via registerFlowAction() no módulo (T4.3) — o pacote nunca
// assume nenhum caso de negócio específico.
import { z } from 'zod'

export type FlowNodeType = 'question' | 'entrada_choice' | 'action' | 'menu' | 'condition' | 'dynamic_choice'
export type FlowQuestionType = 'text' | 'money' | 'date' | 'time' | 'int' | 'cpf' | 'choice'
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
/**
 * `byKeyword`: texto livre que casa com a palavra-chave (sem acento, sem caixa) leva ao destino. É o
 * que permite responder "qual o horário?" num menu sem o cliente tocar em opção nenhuma.
 */
export type FlowNodeNext =
  string | { byAnswer: Record<string, string>; byKeyword?: Record<string, string>; default: string }

/**
 * Regras da resposta de uma pergunta. Todas opcionais; o tipo (`questionType`) diz qual se aplica.
 *
 * - `date`: `minDate: 'today'` (ou `yyyy-mm-dd`) recusa data anterior; `afterContextKey` exige data
 *   posterior à guardada naquela chave (saída depois da entrada).
 * - `time`: `minTime` e `maxTime` (`HH:MM`, inclusivos); `windowsContextKey` aponta a chave do contexto
 *   com as faixas permitidas (`[{ start: '11:00', end: '14:00' }]` ou `['11:00-14:00']`), que o host
 *   preenche antes da pergunta (uma action, `resolveVariables`) — faixa que vira a meia-noite vale.
 * - `int` / `money`: `min` e `max` inclusivos.
 * - `text`: `minLength` e `maxLength`, em caracteres.
 */
export type FlowAnswerValidation = {
  minDate?: string
  afterContextKey?: string
  minTime?: string
  maxTime?: string
  windowsContextKey?: string
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
}

/** Descrição (cinza, abaixo do título) e seção de uma opção quando ela sai como linha de lista. */
export type FlowOptionDetail = {
  description?: string
  section?: string
}

// Destinos "flow:<key>" são saltos para outro fluxo — mesma convenção usada pelo editor visual
// (conversations-ui/flows/flowGraph.ts); backend e frontend precisam concordar no formato.
export const CROSS_FLOW_PREFIX = 'flow:'
export const isCrossFlowTarget = (target: string): boolean => target.startsWith(CROSS_FLOW_PREFIX)
export const crossFlowKey = (target: string): string => target.slice(CROSS_FLOW_PREFIX.length)

export type FlowNodeData = {
  id: string
  type: FlowNodeType
  // Apelido do nó no editor. Só rótulo: o motor do bot ignora, e serve pra distinguir dois nós do
  // mesmo tipo ("Enviar tabela de juros" x "Enviar contrato") que sem isso ficam idênticos no card.
  label?: string
  contextKey?: string
  questionType?: FlowQuestionType
  question?: string
  options?: [string, string][]
  actionKind?: FlowActionKind
  // Parâmetros arbitrários que o nó carrega para o handler registrado em `actionKind`. O pacote
  // nunca os interpreta — é o que permite um nó de ação ser configurado pelo editor sem que o
  // vocabulário do produto (o antigo `simulationTemplate`) vaze para dentro do contrato.
  actionParams?: Record<string, unknown>
  /** Por id de opção. Opção com descrição ou seção sai em lista, mesmo com até 3 opções. */
  optionDetails?: Record<string, FlowOptionDetail>
  /** Texto do botão que abre a lista. Ausente, vale o padrão do runner. */
  listButtonLabel?: string
  /** Regras da resposta (ver `FlowAnswerValidation`). */
  validation?: FlowAnswerValidation
  /**
   * Destinos que o handler da action PODE devolver em `next` (ids de nó ou `flow:<chave>`). O runtime
   * não lê — quem decide é o handler; serve para o editor desenhar esses caminhos e não acusar o nó
   * de destino como inalcançável.
   */
  possibleNext?: string[]
  /** Respostas que pulam a pergunta: a chave recebe `null` e o fluxo segue pelo `default`. */
  skipKeywords?: string[]
  /** Tentativas inválidas antes do encaminhamento a uma pessoa. Ausente, vale o padrão do runner (2). */
  maxInvalidAnswers?: number
  /**
   * Resposta que não casa com nenhuma opção: `reask` (padrão do runner) repergunta e conta tentativa;
   * `default` segue para `next.default` guardando o texto cru — o comportamento do interpretador puro.
   */
  unmatchedChoice?: 'reask' | 'default'
  /** Nó `dynamic_choice`: chave do provedor de opções registrado pelo host. */
  choiceProvider?: string
  directMessage?: string
  fallbackMessage?: string
  conditionContextKey?: string
  conditionOperator?: FlowConditionOperator
  conditionValue?: string
  position?: { x: number; y: number }
  next?: FlowNodeNext
}

/**
 * Quem escreveu o conteúdo atual do grafo: o produto, ao semear (`seed`), ou uma pessoa pelo editor
 * (`edited`). Salvar pelo editor sempre vira `edited`; só o reseed do produto devolve para `seed`.
 */
export const FLOW_GRAPH_ORIGIN = {
  SEED: 'seed',
  EDITED: 'edited',
} as const
export type FlowGraphOrigin = (typeof FLOW_GRAPH_ORIGIN)[keyof typeof FLOW_GRAPH_ORIGIN]

export interface FlowGraphData {
  key: string
  label: string
  startNodeId: string
  version: number
  nodes: Record<string, FlowNodeData>
  /** `edited` para grafo que já existia antes do campo: sem como saber, vale o lado seguro. */
  origin?: FlowGraphOrigin
  /** Versão do seed que gerou o conteúdo (escolhida pelo produto); ausente em grafo criado pelo editor. */
  seedVersion?: string
}

export interface FlowGraphSummary {
  key: string
  label: string
  nodeCount: number
  showInMenu: boolean
  menuOptionLabel?: string
  updatedAt: string
  origin?: FlowGraphOrigin
  seedVersion?: string
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
  z.object({
    byAnswer: z.record(z.string(), z.string()),
    byKeyword: z.record(z.string(), z.string()).optional(),
    default: z.string(),
  }),
])

export const flowAnswerValidationSchema = z.object({
  minDate: z.union([z.literal('today'), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
  afterContextKey: z.string().optional(),
  minTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  maxTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  windowsContextKey: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional(),
})

export const flowNodeDataSchema = z
  .object({
    id: z.string(),
    type: z.enum(['question', 'entrada_choice', 'action', 'menu', 'condition', 'dynamic_choice']),
    contextKey: z.string().optional(),
    questionType: z.enum(['text', 'money', 'date', 'time', 'int', 'cpf', 'choice']).optional(),
    question: z.string().optional(),
    options: z.array(z.tuple([z.string(), z.string()])).optional(),
    actionKind: z.string().optional(),
    actionParams: z.record(z.string(), z.unknown()).optional(),
    optionDetails: z
      .record(z.string(), z.object({ description: z.string().optional(), section: z.string().optional() }))
      .optional(),
    listButtonLabel: z.string().optional(),
    validation: flowAnswerValidationSchema.optional(),
    possibleNext: z.array(z.string()).optional(),
    skipKeywords: z.array(z.string()).optional(),
    maxInvalidAnswers: z.number().int().positive().optional(),
    unmatchedChoice: z.enum(['reask', 'default']).optional(),
    choiceProvider: z.string().optional(),
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
