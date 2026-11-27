/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useEffect, useRef, type RefObject } from 'react'

import { DEFAULT_PREVIEW_CHANNEL, parseGuestMessage, wrapHostMessage, type HostMessage } from '../protocol'

import { readPreviewScroll, writePreviewScroll } from './scrollMemory'

const DEFAULT_DEBOUNCE_MILLISECONDS = 250

export type UseSitePreviewChannelParams = {
  readonly frameRef: RefObject<HTMLIFrameElement | null>
  /** Rascunho a mostrar no site (formato livre, o site decide em `onState`). */
  readonly payload?: unknown
  /** Chave da seção em edição: o site a destaca e rola até ela. */
  readonly focus?: string | undefined
  /** Muda quando algo salvo no servidor mudou (ex.: foto): o site recarrega os dados, sem recarregar a página. */
  readonly refreshKey?: string | number | undefined
  readonly channel?: string
  /** Onde guardar a rolagem; padrão `channel`. Uma chave por tela de prévia. */
  readonly storageKey?: string
  readonly debounceMilliseconds?: number
}

export function useSitePreviewChannel(params: UseSitePreviewChannelParams): void {
  const { frameRef, payload, focus, refreshKey } = params
  const channel = params.channel ?? DEFAULT_PREVIEW_CHANNEL
  const storageKey = params.storageKey ?? channel
  const delay = params.debounceMilliseconds ?? DEFAULT_DEBOUNCE_MILLISECONDS
  const latestRef = useRef({ payload, focus })
  latestRef.current = { payload, focus }

  function post(message: HostMessage): void {
    const target = frameRef.current?.contentWindow
    if (target === null || target === undefined) return
    target.postMessage(wrapHostMessage(channel, message), window.location.origin)
  }

  useEffect(() => {
    function handleMessage(event: MessageEvent): void {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return
      const message = parseGuestMessage(event.data, channel)
      if (message === undefined) return
      if (message.type === 'scroll') {
        writePreviewScroll(storageKey, message.top)
        return
      }
      const saved = readPreviewScroll(storageKey)
      if (saved > 0) post({ type: 'restore-scroll', top: saved })
      post({ type: 'state', payload: latestRef.current.payload })
      post({ type: 'focus', key: latestRef.current.focus })
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [channel, storageKey])

  useEffect(() => {
    const timer = window.setTimeout(() => post({ type: 'state', payload }), delay)
    return () => window.clearTimeout(timer)
  }, [payload])

  useEffect(() => {
    post({ type: 'focus', key: focus })
  }, [focus])

  useEffect(() => {
    if (refreshKey === undefined) return
    post({ type: 'refresh' })
  }, [refreshKey])
}
