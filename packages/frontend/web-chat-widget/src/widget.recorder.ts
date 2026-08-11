/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import { AUDIO_MAX_SECONDS, AUDIO_MIME_CANDIDATES } from './widget.constant'

/** Nem todo navegador grava, e nenhum grava sem `https`. O widget so oferece o microfone onde da. */
export function isRecordingSupported(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices?.getUserMedia !== undefined
  )
}

function pickMimeType(): string {
  return AUDIO_MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? ''
}

/**
 * Gravacao de um audio por vez, com a trilha do microfone fechada no fim.
 *
 * Deixar a `MediaStream` aberta mantem o indicador de gravacao aceso na aba depois que o visitante
 * ja parou — parece que a pagina continua ouvindo, e para quem esta do outro lado nao ha diferenca
 * entre parecer e estar.
 */
export class AudioRecorder {
  #recorder: MediaRecorder | undefined
  #chunks: Blob[] = []
  #timeout?: ReturnType<typeof setTimeout>

  get isRecording(): boolean {
    return this.#recorder?.state === 'recording'
  }

  async start(onAutoStop: () => void): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = pickMimeType()

    this.#chunks = []
    this.#recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    this.#recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) this.#chunks.push(event.data)
    })
    this.#recorder.start()

    // Teto de duracao: microfone esquecido aberto vira upload gigante e conta de transcricao.
    this.#timeout = setTimeout(onAutoStop, AUDIO_MAX_SECONDS * 1_000)
  }

  async stop(): Promise<Blob | undefined> {
    const recorder = this.#recorder
    if (!recorder || recorder.state === 'inactive') return undefined

    clearTimeout(this.#timeout)

    const blob = await new Promise<Blob>((resolve) => {
      recorder.addEventListener(
        'stop',
        () => resolve(new Blob(this.#chunks, { type: recorder.mimeType || 'audio/webm' })),
        { once: true },
      )
      recorder.stop()
    })

    recorder.stream.getTracks().forEach((track) => track.stop())
    this.#recorder = undefined
    this.#chunks = []

    return blob.size > 0 ? blob : undefined
  }
}
