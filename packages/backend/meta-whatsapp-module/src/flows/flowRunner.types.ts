/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Configuração do runner de fluxo. Tudo opcional: sem nada, o runner atende pelo fluxo `main`, com
 * os textos padrão em pt-BR e encaminhamento a uma pessoa depois de 2 respostas inválidas.
 */

import type {
  BusinessHours,
  ConversationSession,
  DynamicChoiceProvider,
  FlowAnswerRejection,
  FlowDateLocale,
  FlowNodeData,
  InterpolateFlowTextOptions,
} from '@adatechnology/meta-whatsapp-contracts'

/** Qual texto do runner está sendo pedido ao resolvedor. */
export type FlowTextKind = 'fallback' | 'rejection' | 'non-text-answer' | 'handoff' | 'handoff-out-of-hours'

export type FlowTextContext = {
  readonly companyId: string
  readonly whatsappNumber: string
  readonly kind: FlowTextKind
  /** Só em `kind: 'rejection'`. */
  readonly rejection?: FlowAnswerRejection
  /** Nó em que a conversa está, quando há um. */
  readonly nodeId?: string
  readonly flowKey?: string | null
}

/**
 * Texto resolvido a cada uso, por empresa/conversa (modelos editados no painel, idioma do cliente).
 * `undefined` cai no próximo texto da cadeia e, no fim, no padrão do pacote. O texto devolvido aceita
 * `{{chave}}` como o fixo. Se lançar, o erro vai para `onFlowRunnerError` (`stage: 'text'`) e vale o
 * padrão — o cliente nunca fica sem resposta por causa do resolvedor.
 */
export type FlowTextResolver = (context: FlowTextContext) => string | undefined | Promise<string | undefined>

/** Texto fixo ou resolvido por empresa/conversa. */
export type FlowConfigText = string | FlowTextResolver

/** O que o validador do host devolve: `undefined`/`{ isValid: true }` aceita. */
export type FlowAnswerValidatorResult =
  | undefined
  | { readonly isValid: true }
  /** `message` (aceita `{{chave}}`) substitui o texto de nova tentativa só desta vez. */
  | { readonly isValid: false; readonly message?: string }

/**
 * Validação extra do host, depois da do pacote ter aceitado a resposta (formato, mínimo, máximo).
 * Ex.: horário dentro das faixas livres da agenda, data com vaga. Recusa conta como resposta inválida
 * (`rejected-by-host`), com o mesmo mecanismo de nova tentativa e encaminhamento.
 */
export type FlowAnswerValidator = (params: {
  readonly companyId: string
  readonly session: ConversationSession
  readonly node: FlowNodeData
  /** Texto do cliente, aparado. */
  readonly answer: string
  /** Valor já convertido pelo pacote (`HH:MM`, `yyyy-mm-dd`, número...). */
  readonly value: unknown
  readonly context: Readonly<Record<string, unknown>>
}) => FlowAnswerValidatorResult | Promise<FlowAnswerValidatorResult>

/** `restart` volta ao início do fluxo de partida; `handoff` chama uma pessoa; `flow:<chave>` abre outro fluxo. */
export type FlowGlobalKeywordTarget = 'restart' | 'handoff' | `flow:${string}`

/** `exact`: a mensagem inteira é a palavra; `word`: a palavra aparece inteira dentro da mensagem. */
export type FlowGlobalKeywordMatch = 'exact' | 'word'

/** Palavras que valem em qualquer nó ("menu", "atendente"), comparadas sem acento e sem caixa. */
export type FlowGlobalKeyword = {
  readonly keywords: readonly string[]
  /** Padrão `exact`. Com `word`, "quero falar com o atendente" aciona "atendente"; a palavra mais longa vence. */
  readonly match?: FlowGlobalKeywordMatch
  readonly target: FlowGlobalKeywordTarget
}

export type FlowHandoffConfig = {
  /** Mensagem dentro do horário (ou sempre, sem `businessHours`). Aceita `{{chave}}`. */
  readonly message?: FlowConfigText
  /** Mensagem fora do horário. Ausente, vale `message`. */
  readonly outOfHoursMessage?: FlowConfigText
  /** Fixo, ou resolvido por empresa a cada encaminhamento (o painel pode mudar sem deploy). */
  readonly businessHours?: BusinessHours | ((companyId: string) => Promise<BusinessHours | undefined>)
}

export type FlowVariablesResolver = (params: {
  readonly session: ConversationSession
  readonly profileName?: string
}) => Promise<Readonly<Record<string, unknown>>>

export type FlowRunnerConfig = {
  /** Fluxo de quem chega sem conversa em andamento. Padrão `main`. */
  readonly startFlowKey?: string
  readonly globalKeywords?: readonly FlowGlobalKeyword[]
  /** Respostas inválidas seguidas no mesmo nó antes de chamar uma pessoa. Padrão 2; o nó pode sobrescrever. */
  readonly maxInvalidAnswers?: number
  /** Texto de nova tentativa quando o nó não declara `fallbackMessage`. */
  readonly defaultFallbackMessage?: FlowConfigText
  /** Texto de nova tentativa por motivo, antes do padrão ("essa data já passou"). */
  readonly rejectionMessages?: Partial<Record<FlowAnswerRejection, FlowConfigText>>
  /** Corpo de escolha quando o nó não tem `question` (a Meta exige corpo). */
  readonly choicePrompt?: string
  readonly listButtonLabel?: string
  /** Rótulo da linha que pede a próxima página de um `dynamic_choice`. */
  readonly seeMoreLabel?: string
  readonly dateLocale?: FlowDateLocale
  /**
   * Fuso de "hoje" na validação de data (IANA). Obrigatório — ou derivado de
   * `handoff.businessHours.timeZone` quando o horário é fixo: servidor em UTC aceitaria "hoje" errado
   * entre 21h e meia-noite no Brasil.
   */
  readonly timeZone?: string
  /** Resposta que não casa com opção: `reask` (padrão) ou `default` (segue `next.default`). O nó sobrescreve. */
  readonly unmatchedChoice?: 'reask' | 'default'
  /** Resposta em áudio, imagem, localização… num nó que espera texto: avisa e repergunta, sem contar tentativa. */
  readonly nonTextAnswerMessage?: FlowConfigText
  /** Validação extra das perguntas (não de escolha), depois da do pacote. Ver `FlowAnswerValidator`. */
  readonly validateAnswer?: FlowAnswerValidator
  readonly handoff?: FlowHandoffConfig
  /**
   * Conversa que pediu atendimento e saiu do fluxo: `silent` (padrão) não responde até alguém
   * assumir ou devolver ao bot — palavras globais continuam valendo; `continue` reabre o fluxo.
   */
  readonly whileAwaitingHuman?: 'silent' | 'continue'
  /** Variáveis do host para `{{chave}}` (dados do cadastro, por exemplo). O contexto do fluxo tem precedência. */
  readonly resolveVariables?: FlowVariablesResolver
  readonly formatValue?: InterpolateFlowTextOptions['formatValue']
  readonly dynamicChoiceProviders?: Readonly<Record<string, DynamicChoiceProvider>>
  /** Saltos `flow:` seguidos numa mesma mensagem antes de desistir (protege de ciclo entre fluxos). Padrão 5. */
  readonly maxCrossFlowJumps?: number
  /** Relógio injetável para teste. */
  readonly now?: () => Date
}

export type FlowRunnerOutcome = 'handled' | 'duplicate' | 'no-session' | 'human-mode' | 'awaiting-human' | 'no-flow'
