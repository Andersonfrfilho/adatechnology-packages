/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { parseGuestMessage, parseHostMessage, wrapGuestMessage, wrapHostMessage } from './protocol'

describe('protocolo da prévia', () => {
  it('leva cada mensagem do painel de ida e volta', () => {
    expect(parseHostMessage(wrapHostMessage('x', { type: 'focus', key: 'photos.gallery' }), 'x')).toEqual({
      type: 'focus',
      key: 'photos.gallery',
    })
    expect(parseHostMessage(wrapHostMessage('x', { type: 'state', payload: { a: 1 } }), 'x')).toEqual({
      type: 'state',
      payload: { a: 1 },
    })
    expect(parseHostMessage(wrapHostMessage('x', { type: 'refresh' }), 'x')).toEqual({ type: 'refresh' })
    expect(parseHostMessage(wrapHostMessage('x', { type: 'restore-scroll', top: 480 }), 'x')).toEqual({
      type: 'restore-scroll',
      top: 480,
    })
  })

  it('leva as mensagens do site de ida e volta', () => {
    expect(parseGuestMessage(wrapGuestMessage('x', { type: 'ready' }), 'x')).toEqual({ type: 'ready' })
    expect(parseGuestMessage(wrapGuestMessage('x', { type: 'scroll', top: 12.5 }), 'x')).toEqual({
      type: 'scroll',
      top: 12.5,
    })
  })

  it('descarta mensagem de outro canal, de outra direção ou de outra versão', () => {
    const fromHost = wrapHostMessage('x', { type: 'refresh' })
    expect(parseHostMessage(fromHost, 'other')).toBeUndefined()
    expect(parseGuestMessage(fromHost, 'x')).toBeUndefined()
    expect(parseHostMessage({ ...fromHost, version: 2 }, 'x')).toBeUndefined()
  })

  it('descarta formato inválido', () => {
    const host = (message: unknown): unknown => ({ source: 'x:host', version: 1, message })
    expect(parseHostMessage(host({ type: 'focus', key: 3 }), 'x')).toBeUndefined()
    expect(parseHostMessage(host({ type: 'restore-scroll', top: Number.NaN }), 'x')).toBeUndefined()
    expect(parseHostMessage(host({ type: 'unknown' }), 'x')).toBeUndefined()
    expect(parseHostMessage(null, 'x')).toBeUndefined()
    expect(parseHostMessage('texto', 'x')).toBeUndefined()
    expect(
      parseGuestMessage({ source: 'x:guest', version: 1, message: { type: 'scroll', top: 'a' } }, 'x'),
    ).toBeUndefined()
  })

  it('nunca aceita rolagem negativa', () => {
    expect(parseHostMessage(wrapHostMessage('x', { type: 'restore-scroll', top: -40 }), 'x')).toEqual({
      type: 'restore-scroll',
      top: 0,
    })
  })
})
