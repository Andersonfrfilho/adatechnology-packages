/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import locale from './widget.locale.json'

const BEEP_FREQUENCY_HZ = 880
const BEEP_SECONDS = 0.14
const BEEP_GAIN = 0.06

/**
 * Aviso de mensagem nova: som curto e, se permitido, notificacao do navegador.
 *
 * Tudo aqui e best-effort e silencioso na falha. O visitante esta numa landing, nao num app que ele
 * instalou: se o navegador bloquear audio ou negar a permissao, o badge do launcher ja resolve, e
 * um erro no console por causa de um bip seria ruido puro.
 *
 * O `AudioContext` so nasce no primeiro gesto do usuario (o clique que abre o chat) — criado no
 * carregamento da pagina ele ja nasceria suspenso pela politica de autoplay, e o primeiro aviso,
 * justamente o que importa, sairia mudo.
 *
 * Nada do conteudo da mensagem entra na notificacao: o corpo e texto fixo. O que o cliente escreve
 * e conteudo de conversa, e o titulo de uma notificacao do sistema aparece na tela de bloqueio.
 */
export class WidgetNotifier {
  #audioContext?: AudioContext
  #hasAskedPermission = false

  /** Chamado no gesto que abre o painel: e a unica janela em que o navegador libera as duas coisas. */
  unlock(): void {
    this.#ensureAudioContext()
    this.#requestPermission()
  }

  notify(): void {
    this.#beep()
    this.#showNotification()
  }

  #ensureAudioContext(): void {
    if (this.#audioContext) return void this.#audioContext.resume().catch(() => undefined)

    try {
      this.#audioContext = new AudioContext()
    } catch {
      // Navegador sem Web Audio: segue sem som, o badge e a notificacao continuam valendo.
    }
  }

  #requestPermission(): void {
    if (this.#hasAskedPermission) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return

    this.#hasAskedPermission = true
    Notification.requestPermission().catch(() => undefined)
  }

  /** Sintetizado, e nao um arquivo: um `.mp3` em base64 engordaria o bundle do widget por um bip. */
  #beep(): void {
    const context = this.#audioContext
    if (!context || context.state === 'closed') return

    try {
      const oscillator = context.createOscillator()
      const gain = context.createGain()

      oscillator.frequency.value = BEEP_FREQUENCY_HZ
      oscillator.type = 'sine'
      gain.gain.setValueAtTime(BEEP_GAIN, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + BEEP_SECONDS)

      oscillator.connect(gain).connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + BEEP_SECONDS)
    } catch {
      // Aviso sonoro nao e funcionalidade: falhou, o badge continua de pe.
    }
  }

  #showNotification(): void {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (!document.hidden) return

    try {
      new Notification(locale.notification.title, { body: locale.notification.body })
    } catch {
      // Alguns navegadores exigem service worker para o construtor; sem ele, so o badge e o som.
    }
  }
}
