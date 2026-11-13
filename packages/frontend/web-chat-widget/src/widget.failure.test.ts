/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import { describe, expect, it } from 'bun:test'

import { AUDIO_ERROR_CODE, AUDIO_FALLBACK_RETRY_SECONDS } from './widget.constant'
import { WidgetRequestError, getApiErrorCode } from './widget.error'
import { toAudioFailureMessage } from './widget.failure'

function requestError(code: string, status: number, retryAfterSeconds = 0): WidgetRequestError {
  return new WidgetRequestError({ status, code, retryAfterSeconds })
}

describe('toAudioFailureMessage', () => {
  it('cota estourada avisa quanto esperar', () => {
    const message = toAudioFailureMessage(requestError(AUDIO_ERROR_CODE.BUSY, 429, 12))

    expect(message).toContain('12s')
  })

  it('sem prazo do servidor a frase ainda traz um numero', () => {
    const message = toAudioFailureMessage(requestError(AUDIO_ERROR_CODE.BUSY, 429))

    expect(message).toContain(`${AUDIO_FALLBACK_RETRY_SECONDS}s`)
    expect(message).not.toContain('{seconds}')
  })

  it('engine fora do ar convida a escrever em vez de mandar esperar', () => {
    const message = toAudioFailureMessage(requestError(AUDIO_ERROR_CODE.FAILED, 502))

    expect(message).toContain('Escreva')
    expect(message).not.toContain('s —')
  })

  it('o limite da propria rota fala a mesma lingua da cota do provedor', () => {
    const byRoute = toAudioFailureMessage(requestError(AUDIO_ERROR_CODE.RATE_LIMITED, 429, 5))
    const byProvider = toAudioFailureMessage(requestError(AUDIO_ERROR_CODE.BUSY, 429, 5))

    expect(byRoute).toBe(byProvider)
  })

  it('sem codigo no corpo o status ainda distingue esperar de escrever', () => {
    const busy = toAudioFailureMessage(requestError('', 429, 7))
    const unavailable = toAudioFailureMessage(requestError('', 503))

    expect(busy).toContain('7s')
    expect(unavailable).toContain('Escreva')
  })

  it('falha que nao veio da rota cai na frase generica', () => {
    expect(toAudioFailureMessage(new Error('offline'))).toContain('áudio')
  })
})

describe('getApiErrorCode', () => {
  it('le o codigo do envelope de erro da API', () => {
    expect(getApiErrorCode({ error: { code: 'X', message: 'y' } })).toBe('X')
  })

  it('corpo fora do contrato nao derruba a tela', () => {
    expect(getApiErrorCode(undefined)).toBe('')
    expect(getApiErrorCode('<html>502</html>')).toBe('')
    expect(getApiErrorCode({ error: {} })).toBe('')
    expect(getApiErrorCode({ error: { code: 7 } })).toBe('')
  })
})
