/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

/** Uma opcao clicavel de um no de menu. O `id` e o que a API espera de volta como resposta. */
export type WidgetOption = {
  readonly id: string
  readonly title: string
}

export type WidgetMessage = {
  readonly id: string
  readonly direction: string
  readonly sender: string
  readonly type: string
  readonly content: string | null
  readonly options: readonly WidgetOption[]
  /** Que tipo de resposta o no espera (`name`, `email`, `phone`, `contact`…), quando a API informa. */
  readonly answerKind: string
  readonly createdAt: string
}

/**
 * O que o campo de texto espera agora, para o navegador poder preencher sozinho.
 *
 * Vem da propria pergunta do fluxo: sem isto o widget teria de adivinhar pelo enunciado, e nome,
 * e-mail e telefone — os tres campos que o autocomplete resolve num toque — passariam batidos.
 */
export type WidgetInputHint = {
  readonly autocomplete: string
  readonly inputMode: string
  readonly type: string
}

export type WidgetTranscript = {
  readonly messages: readonly WidgetMessage[]
  readonly options: readonly WidgetOption[]
  readonly inputHint: WidgetInputHint
}

export type PostMessageResult = {
  readonly outcome: string
}

export type WidgetApiParams = {
  readonly baseUrl: string
}

export type PostMessageParams = {
  readonly sessionId: string
  readonly text: string
}

export type PostAudioParams = {
  readonly sessionId: string
  readonly audio: Blob
}

export type SubscribeParams = {
  readonly sessionId: string
  readonly onChange: () => void
}

export type WidgetViewState = {
  readonly isOpen: boolean
  readonly isBusy: boolean
  readonly isRecording: boolean
  readonly status: string
  readonly hasFailed: boolean
  readonly transcript: WidgetTranscript
}

/**
 * `onToggleRecording` ausente nao desenha o microfone.
 *
 * Capacidade opcional e por ausencia, nunca por flag: navegador sem `MediaRecorder` ou API sem
 * transcricao configurada simplesmente nao passa o callback, e o affordance nao existe.
 */
export type WidgetViewHandlers = {
  readonly onToggle: () => void
  readonly onSubmit: (text: string) => void
  readonly onToggleRecording?: () => void
}
