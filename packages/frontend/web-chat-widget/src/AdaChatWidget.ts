/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import { WidgetApi } from './widget.api'
import { API_BASE_ATTRIBUTE, DEFAULT_INPUT_HINT, HANDOFF_OUTCOME, SESSION_STORAGE_KEY } from './widget.constant'
import { toAudioFailureMessage } from './widget.failure'
import locale from './widget.locale.json'
import { AudioRecorder, isRecordingSupported } from './widget.recorder'
import { WidgetView } from './widget.view'
import type { WidgetTranscript } from './types/widget.types'

const EMPTY_TRANSCRIPT: WidgetTranscript = { messages: [], options: [], inputHint: DEFAULT_INPUT_HINT }

/**
 * O elemento so guarda estado e liga API e tela.
 *
 * A sessao nasce no primeiro clique, nao no carregamento da pagina: visitante que nunca abre o chat
 * nao vira conversa no painel nem consome a cota de criacao de sessao.
 */
export class AdaChatWidget extends HTMLElement {
  #api?: WidgetApi
  #view?: WidgetView
  readonly #recorder = new AudioRecorder()
  #unsubscribe: (() => void) | undefined
  #sessionId = ''
  #isOpen = false
  #isBusy = false
  #isRecording = false
  #status = ''
  #hasFailed = false
  #transcript: WidgetTranscript = EMPTY_TRANSCRIPT

  connectedCallback(): void {
    const baseUrl = this.getAttribute(API_BASE_ATTRIBUTE)
    if (!baseUrl) throw new Error(`<ada-chat-widget> requires the ${API_BASE_ATTRIBUTE} attribute`)

    this.#api = new WidgetApi({ baseUrl })
    this.#sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY) ?? ''
    this.#view = new WidgetView(this.attachShadow({ mode: 'open' }), {
      onToggle: () => void this.#toggle(),
      onSubmit: (text) => void this.#submit(text),
      // Navegador sem `MediaRecorder` nao recebe o callback, e o microfone nem chega a existir.
      ...(isRecordingSupported() ? { onToggleRecording: () => void this.#toggleRecording() } : {}),
    })

    this.#render()
  }

  disconnectedCallback(): void {
    this.#unsubscribe?.()
    this.#unsubscribe = undefined
  }

  #render(): void {
    this.#view?.render({
      isOpen: this.#isOpen,
      isBusy: this.#isBusy,
      isRecording: this.#isRecording,
      status: this.#status,
      hasFailed: this.#hasFailed,
      transcript: this.#transcript,
    })
  }

  #setStatus(status: string, hasFailed = false): void {
    this.#status = status
    this.#hasFailed = hasFailed
    this.#render()
  }

  async #toggle(): Promise<void> {
    this.#isOpen = !this.#isOpen
    this.#render()

    if (!this.#isOpen) return

    this.#view?.focusInput()
    await this.#start()
  }

  /**
   * Sessao gravada que o servidor ja nao conhece derruba o widget para sempre sem este descarte.
   *
   * A conversa expira no servidor e a aba continua com o id antigo; o `catch` limpa e abre outra,
   * senao o visitante ficaria olhando a mesma mensagem de erro a cada clique.
   */
  async #start(): Promise<void> {
    if (!this.#api || this.#isBusy) return

    this.#isBusy = true
    this.#setStatus(this.#sessionId ? '' : locale.status.starting)

    try {
      if (!this.#sessionId) await this.#openSession()
      await this.#refresh()
      this.#listen()
      this.#setStatus('')
    } catch {
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
      this.#sessionId = ''
      this.#setStatus(locale.status.startFailed, true)
    } finally {
      this.#isBusy = false
      this.#render()
    }
  }

  async #openSession(): Promise<void> {
    if (!this.#api) return

    this.#sessionId = await this.#api.createSession()
    sessionStorage.setItem(SESSION_STORAGE_KEY, this.#sessionId)
  }

  async #refresh(): Promise<void> {
    if (!this.#api || !this.#sessionId) return

    this.#transcript = await this.#api.listMessages(this.#sessionId)
    this.#render()
  }

  #listen(): void {
    if (!this.#api || this.#unsubscribe) return

    this.#unsubscribe = this.#api.subscribe({
      sessionId: this.#sessionId,
      onChange: () => void this.#refresh(),
    })
  }

  /**
   * O mesmo botao comeca e termina a gravacao.
   *
   * Enquanto grava, o widget nao fica ocupado: o visitante continua podendo digitar e desistir do
   * audio. So o envio bloqueia, porque ai a conversa realmente andou um passo.
   */
  async #toggleRecording(): Promise<void> {
    if (this.#isRecording) return this.#finishRecording()

    try {
      await this.#recorder.start(() => void this.#finishRecording())
      this.#isRecording = true
      this.#setStatus(locale.status.recording)
    } catch {
      this.#setStatus(locale.status.microphoneDenied, true)
    }
  }

  async #finishRecording(): Promise<void> {
    const audio = await this.#recorder.stop()
    this.#isRecording = false

    if (!audio || !this.#api || !this.#sessionId) return this.#setStatus('')

    this.#isBusy = true
    this.#setStatus(locale.status.transcribing)

    try {
      const { outcome } = await this.#api.postAudio({ sessionId: this.#sessionId, audio })
      await this.#refresh()
      this.#setStatus(HANDOFF_OUTCOME.includes(outcome) ? locale.status.handedOff : '')
    } catch (error) {
      this.#setStatus(toAudioFailureMessage(error), true)
    } finally {
      this.#isBusy = false
      this.#render()
    }
  }

  async #submit(text: string): Promise<void> {
    if (!this.#api || !this.#sessionId || this.#isBusy) return

    this.#isBusy = true
    this.#render()

    try {
      const { outcome } = await this.#api.postMessage({ sessionId: this.#sessionId, text })
      await this.#refresh()
      this.#setStatus(HANDOFF_OUTCOME.includes(outcome) ? locale.status.handedOff : '')
    } catch {
      this.#setStatus(locale.status.sendFailed, true)
    } finally {
      this.#isBusy = false
      this.#render()
    }
  }
}
