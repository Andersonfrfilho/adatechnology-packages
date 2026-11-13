/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import { MESSAGE_MAX_LENGTH } from './widget.constant'
import { applyIcon } from './widget.icon'
import { buildMascot } from './widget.mascot'
import { applyWidgetStyle } from './widget.style'
import { buildTranscriptNodes } from './widget.transcript'
import locale from './widget.locale.json'
import type { WidgetViewHandlers, WidgetViewState } from './types/widget.types'

/**
 * Monta a arvore uma vez e so troca conteudo depois.
 *
 * Todo texto vindo do servidor entra por `textContent`. O widget e embutido em pagina publica e o
 * conteudo e editado no painel: `innerHTML` aqui transformaria o editor de fluxo em injecao de HTML
 * na landing.
 */
export class WidgetView {
  readonly #handlers: WidgetViewHandlers
  readonly #launcher = document.createElement('button')
  readonly #badge = document.createElement('span')
  readonly #panel = document.createElement('section')
  readonly #transcript = document.createElement('div')
  readonly #typing = document.createElement('div')
  readonly #options = document.createElement('div')
  readonly #status = document.createElement('p')
  readonly #input = document.createElement('input')
  readonly #mic = document.createElement('button')
  readonly #send = document.createElement('button')
  #renderedIds = ''

  constructor(root: ShadowRoot, handlers: WidgetViewHandlers) {
    this.#handlers = handlers

    applyWidgetStyle(root)
    root.append(this.#launcher, this.#panel)

    this.#buildLauncher()
    this.#buildPanel()
  }

  #buildLauncher(): void {
    this.#launcher.className = 'launcher'
    this.#launcher.type = 'button'

    const label = document.createElement('span')
    label.textContent = locale.launcher.open

    this.#badge.className = 'badge'
    this.#badge.hidden = true

    this.#launcher.append(buildMascot('mascot mascot-launcher'), label, this.#badge)
    this.#launcher.addEventListener('click', this.#handlers.onToggle)
  }

  #buildPanel(): void {
    this.#panel.className = 'panel'
    this.#panel.hidden = true
    this.#panel.setAttribute('aria-label', locale.header.title)

    this.#transcript.className = 'transcript'
    this.#transcript.setAttribute('role', 'log')
    this.#transcript.setAttribute('aria-live', 'polite')

    this.#typing.className = 'typing'
    this.#typing.hidden = true
    this.#typing.append(...[0, 1, 2].map(() => document.createElement('span')))

    this.#options.className = 'options'
    this.#status.className = 'status'
    this.#status.hidden = true

    this.#panel.append(
      this.#buildHeader(),
      this.#transcript,
      this.#typing,
      this.#options,
      this.#status,
      this.#buildComposer(),
    )
  }

  #buildHeader(): HTMLElement {
    const header = document.createElement('header')
    header.className = 'header'

    const heading = document.createElement('div')
    heading.className = 'header-heading'
    const title = document.createElement('p')
    title.className = 'header-title'
    title.textContent = locale.header.title
    const subtitle = document.createElement('p')
    subtitle.className = 'header-subtitle'
    subtitle.textContent = locale.header.subtitle
    heading.append(title, subtitle)

    const close = document.createElement('button')
    close.className = 'close'
    close.type = 'button'
    close.textContent = '×'
    close.setAttribute('aria-label', locale.launcher.close)
    close.addEventListener('click', this.#handlers.onToggle)

    header.append(buildMascot('mascot mascot-header'), heading, close)

    return header
  }

  #buildComposer(): HTMLElement {
    const composer = document.createElement('form')
    composer.className = 'composer'

    this.#input.className = 'input'
    this.#input.type = 'text'
    this.#input.maxLength = MESSAGE_MAX_LENGTH
    this.#input.autocomplete = 'off'
    this.#input.placeholder = locale.composer.placeholder
    this.#input.setAttribute('aria-label', locale.composer.placeholder)

    this.#send.className = 'icon-button send'
    this.#send.type = 'submit'
    applyIcon(this.#send, 'send')
    this.#send.setAttribute('aria-label', locale.composer.send)

    composer.addEventListener('submit', (event) => {
      event.preventDefault()
      const text = this.#input.value.trim()
      if (!text) return

      this.#input.value = ''
      this.#handlers.onSubmit(text)
    })

    composer.append(this.#input, this.#buildMicrophone(), this.#send)

    return composer
  }

  /** Sem `onToggleRecording` o botao fica oculto: capacidade opcional e por ausencia, nao por flag. */
  #buildMicrophone(): HTMLElement {
    this.#mic.className = 'icon-button mic'
    this.#mic.type = 'button'
    applyIcon(this.#mic, 'microphone')
    this.#mic.hidden = this.#handlers.onToggleRecording === undefined
    this.#mic.addEventListener('click', () => this.#handlers.onToggleRecording?.())

    return this.#mic
  }

  focusInput(): void {
    this.#input.focus()
  }

  render(state: WidgetViewState): void {
    this.#launcher.hidden = state.isOpen
    this.#panel.hidden = !state.isOpen

    this.#badge.hidden = state.unreadCount === 0
    this.#badge.textContent = String(state.unreadCount)
    this.#badge.setAttribute('aria-label', `${state.unreadCount} ${locale.launcherBadge}`)

    this.#send.disabled = state.isBusy
    this.#typing.hidden = !state.isBusy

    this.#renderComposer(state)
    this.#renderTranscript(state)
    this.#renderOptions(state)

    this.#status.hidden = state.status === ''
    this.#status.textContent = state.status
    this.#status.classList.toggle('status-error', state.hasFailed)
  }

  /** O teclado e a sugestao do navegador seguem a pergunta que esta de pe (ver `widget.mapper.ts`). */
  #renderComposer(state: WidgetViewState): void {
    const hint = state.transcript.inputHint

    // `autocomplete` por atributo: o DOM tipa a propriedade como a enumeracao fechada do HTML, e o
    // valor aqui vem do fluxo publicado — pares como "email tel" sao validos e nao estao nela.
    this.#input.setAttribute('autocomplete', hint.autocomplete)
    this.#input.inputMode = hint.inputMode
    this.#input.type = hint.type

    this.#mic.classList.toggle('mic-recording', state.isRecording)
    this.#mic.setAttribute('aria-label', state.isRecording ? locale.composer.stopRecording : locale.composer.record)
    this.#mic.setAttribute('aria-pressed', String(state.isRecording))
  }

  /** Redesenha so quando o conjunto de mensagens muda: rerender a cada evento perderia o scroll. */
  #renderTranscript(state: WidgetViewState): void {
    const ids = state.transcript.messages.map((message) => message.id).join(',')
    if (ids === this.#renderedIds) return

    this.#renderedIds = ids
    this.#transcript.replaceChildren(...buildTranscriptNodes(state.transcript.messages))
    this.#transcript.scrollTop = this.#transcript.scrollHeight
  }

  /**
   * O clique manda o rotulo, nao o id da opcao.
   *
   * O que sai daqui e gravado como a fala do visitante: com o id, o historico mostraria `dados` no
   * lugar de "Dashboards e dados" — ruido para quem clicou e para o atendente que assume a conversa
   * depois. O validador do fluxo aceita rotulo, id ou posicao, entao a escolha continua casando.
   */
  #renderOptions(state: WidgetViewState): void {
    const { options } = state.transcript
    this.#options.hidden = options.length === 0
    this.#options.replaceChildren(
      ...options.map((option) => {
        const button = document.createElement('button')
        button.className = 'option'
        button.type = 'button'
        button.textContent = option.title
        button.disabled = state.isBusy
        button.addEventListener('click', () => this.#handlers.onSubmit(option.title))

        return button
      }),
    )
  }
}
