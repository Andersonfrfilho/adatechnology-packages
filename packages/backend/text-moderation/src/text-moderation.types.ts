/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type TextModerationConfig = Readonly<{
  /** Desligado, `inspect` devolve sempre limpo — o produto liga por ambiente, sem remover a chamada. */
  isEnabled: boolean
  /** Somado ao núcleo pt-BR. É aqui que entra a variável de ambiente do produto. */
  extraTerms?: readonly string[]
  /** Resgata falso positivo sem mexer no dicionário (ex.: um termo legítimo do nicho do produto). */
  allowedTerms?: readonly string[]
}>

export type TextModerationVerdict = Readonly<{
  isOffensive: boolean
  /** Os termos que casaram, para o log e para a etiqueta que o atendente vê. */
  matchedTerms: readonly string[]
}>

export type TextModerator = Readonly<{
  inspect: (text: string) => TextModerationVerdict
  /** Troca os termos por grawlix. Só para exibição — nunca para gravar no lugar do original. */
  censor: (text: string) => string
}>
