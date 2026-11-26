/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Textos padrão do runner (pt-BR). Todos substituíveis por `FlowRunnerConfig` ou pelo próprio nó.
 */

export const DEFAULT_START_FLOW_KEY = 'main'
export const DEFAULT_MAX_INVALID_ANSWERS = 2
export const DEFAULT_MAX_CROSS_FLOW_JUMPS = 5
/** As esperas padrão somam (500 ms + 1 s) fica abaixo de 2 s: o lock da conversa fica preso durante elas. */
/** Perguntas lembradas para a palavra global `back`; as mais antigas saem primeiro. */
export const DEFAULT_MAX_BACK_TRAIL = 20
export const DEFAULT_SEND_RETRY_MAX_ATTEMPTS = 3
export const DEFAULT_SEND_RETRY_BASE_DELAY_MS = 500
export const DEFAULT_SEND_RETRY_MAX_DELAY_MS = 5000

export const DEFAULT_FLOW_TEXT = {
  FALLBACK: 'Não entendi. Pode responder de novo?',
  CHOICE_PROMPT: 'Escolha uma opção:',
  LIST_BUTTON_LABEL: 'Ver opções',
  SEE_MORE: 'Ver mais',
  NON_TEXT_ANSWER: 'Por aqui eu entendo só texto. Pode escrever a resposta?',
  MORE_OPTIONS_TRUNCATED: '…',
  CANCEL: 'Tudo bem! Cancelei por aqui. Quando quiser, é só mandar uma mensagem.',
  HANDOFF: 'Vou chamar uma pessoa da equipe para continuar por aqui.',
  HANDOFF_OUT_OF_HOURS:
    'Nossa equipe está fora do horário agora. Sua mensagem ficou registrada e respondemos assim que voltarmos.',
} as const

/** Id da linha "ver mais" de um `dynamic_choice`. Começa com `__` para não colidir com id do host. */
export const DYNAMIC_CHOICE_MORE_ID = '__more__'

/**
 * Chave reservada do contexto com o estado do runner (tentativas inválidas, página do
 * `dynamic_choice`). Fica no contexto porque é estado da conversa e precisa sobreviver entre
 * mensagens; o prefixo `__` a separa das respostas do cliente.
 */
export const FLOW_RUNTIME_CONTEXT_KEY = '__flow'

/**
 * Chave reservada do contexto com o rastro das perguntas já feitas (posição + contexto de cada uma),
 * que a palavra global `back` usa para voltar. Separada de `__flow` porque aquele é zerado a cada avanço.
 */
export const FLOW_TRAIL_CONTEXT_KEY = '__flowTrail'
