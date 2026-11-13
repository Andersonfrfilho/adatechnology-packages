/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import {
  AUDIO_FALLBACK_RETRY_SECONDS,
  AUDIO_STATUS_BY_ERROR_CODE,
  AUDIO_STATUS_BY_HTTP_STATUS,
} from './widget.constant'
import { WidgetRequestError } from './widget.error'
import locale from './widget.locale.json'

/**
 * Que frase o visitante le quando o audio nao vira mensagem.
 *
 * Cada motivo pede uma acao diferente: cota estourada pede espera com numero na mao, engine fora do
 * ar pede que escreva, silencio pede que repita. Uma frase unica para os tres devolve o visitante ao
 * mesmo botao que acabou de falhar. Todas terminam convidando a escrever, que e o caminho que
 * continua funcionando quando a transcricao nao esta.
 */
export function toAudioFailureMessage(error: unknown): string {
  if (!(error instanceof WidgetRequestError)) return locale.status.audioFailed

  const key = AUDIO_STATUS_BY_ERROR_CODE[error.code] ?? AUDIO_STATUS_BY_HTTP_STATUS[error.status]
  if (!key) return locale.status.audioFailed

  const seconds = error.retryAfterSeconds || AUDIO_FALLBACK_RETRY_SECONDS

  return locale.status[key].replace('{seconds}', String(seconds))
}
