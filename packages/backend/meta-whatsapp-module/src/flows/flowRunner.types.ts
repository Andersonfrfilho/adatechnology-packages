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
  InterpolateFlowTextOptions,
} from '@adatechnology/meta-whatsapp-contracts'

/** `restart` volta ao início do fluxo de partida; `handoff` chama uma pessoa; `flow:<chave>` abre outro fluxo. */
export type FlowGlobalKeywordTarget = 'restart' | 'handoff' | `flow:${string}`

/** Palavras que valem em qualquer nó ("menu", "atendente"), comparadas sem acento e sem caixa. */
export type FlowGlobalKeyword = {
  readonly keywords: readonly string[]
  readonly target: FlowGlobalKeywordTarget
}

export type FlowHandoffConfig = {
  /** Mensagem dentro do horário (ou sempre, sem `businessHours`). Aceita `{{chave}}`. */
  readonly message?: string
  /** Mensagem fora do horário. Ausente, vale `message`. */
  readonly outOfHoursMessage?: string
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
  readonly defaultFallbackMessage?: string
  /** Texto de nova tentativa por motivo, antes do padrão ("essa data já passou"). */
  readonly rejectionMessages?: Partial<Record<FlowAnswerRejection, string>>
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
  readonly nonTextAnswerMessage?: string
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
