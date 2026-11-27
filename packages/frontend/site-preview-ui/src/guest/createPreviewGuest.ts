/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Lado do site que aparece dentro do iframe da prévia. Sem React: serve a qualquer framework.
 * Fora de um iframe do mesmo domínio ele não faz nada (nenhum ouvinte, nada gravado).
 */

import {
  DEFAULT_PREVIEW_CHANNEL,
  PREVIEW_SECTION_ATTRIBUTE,
  parseHostMessage,
  wrapGuestMessage,
  type GuestMessage,
} from '../protocol'

import { computeScrollTop } from './scrollTarget'

const RESTORE_TIMEOUT_MILLISECONDS = 8000
const RESTORE_POLL_MILLISECONDS = 120
const RESTORE_HOLD_MILLISECONDS = 700
const USER_INPUT_EVENTS = ['wheel', 'touchstart', 'keydown'] as const

export type PreviewGuestOptions = {
  readonly channel?: string
  readonly window?: Window & typeof globalThis
  readonly attribute?: string
  readonly activeClass?: string
  readonly flashClass?: string
  readonly flashMilliseconds?: number
  /** Recebe o que o painel enviou (rascunho a mostrar no lugar do dado salvo). */
  readonly onState?: (payload: unknown) => void
  /** O painel avisa que algo mudou no servidor (ex.: foto nova): o site recarrega os dados sem recarregar a página. */
  readonly onRefresh?: () => void
  /** A seção em edição mudou (`undefined` = nenhuma): o site pode, por exemplo, abrir um modal que só aparece enquanto se edita. */
  readonly onFocusChange?: (key: string | undefined) => void
}

export type PreviewGuest = {
  readonly isActive: boolean
  readonly start: () => void
  readonly stop: () => void
  /** Registra um elemento como seção `key` (além dos que levam o atributo `data-preview-field`). */
  readonly registerSection: (key: string, element: HTMLElement) => () => void
  /** Destaca a seção e, com `reveal` (padrão), rola até ela só se ela não estiver inteira na janela. */
  readonly focus: (key: string | undefined, options?: { readonly reveal?: boolean }) => void
  readonly flash: (key: string) => void
  readonly reapply: () => void
}

export function createPreviewGuest(options: PreviewGuestOptions = {}): PreviewGuest {
  const channel = options.channel ?? DEFAULT_PREVIEW_CHANNEL
  const host: Window & typeof globalThis = options.window ?? window
  const attribute = options.attribute ?? PREVIEW_SECTION_ATTRIBUTE
  const activeClass = options.activeClass ?? 'preview-active'
  const flashClass = options.flashClass ?? 'preview-flash'
  const flashMilliseconds = options.flashMilliseconds ?? 1000
  const isActive = host.parent !== host
  const registered = new Map<string, Set<HTMLElement>>()
  let focusedKey: string | undefined
  let pendingReveal: string | undefined
  let pendingRestore: number | undefined
  let restoreDeadline = 0
  let restoreHoldUntil = 0
  let observer: MutationObserver | undefined
  let frame = 0
  let isStarted = false

  function post(message: GuestMessage): void {
    host.parent.postMessage(wrapGuestMessage(channel, message), host.location.origin)
  }

  function elementsOf(key: string): HTMLElement[] {
    const attributed = [...host.document.querySelectorAll<HTMLElement>(`[${attribute}="${key}"]`)]
    return [...attributed, ...(registered.get(key) ?? [])]
  }

  function firstVisible(key: string): HTMLElement | undefined {
    const elements = elementsOf(key)
    return elements.find((element) => element.getClientRects().length > 0) ?? elements[0]
  }

  function reapply(): void {
    for (const element of host.document.querySelectorAll<HTMLElement>(`.${activeClass}`))
      element.classList.remove(activeClass)
    if (focusedKey === undefined) return
    for (const element of elementsOf(focusedKey)) element.classList.add(activeClass)
  }

  function reveal(key: string): boolean {
    const element = firstVisible(key)
    if (element === undefined) return false
    const box = element.getBoundingClientRect()
    const root = host.document.documentElement
    const top = computeScrollTop({
      elementTop: box.top,
      elementHeight: box.height,
      viewportHeight: host.innerHeight,
      currentScrollTop: host.scrollY,
      documentHeight: root.scrollHeight,
    })
    const prefersReducedMotion = host.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    if (top !== undefined) host.scrollTo({ top, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
    return true
  }

  function focus(key: string | undefined, focusOptions: { readonly reveal?: boolean } = {}): void {
    focusedKey = key
    options.onFocusChange?.(key)
    reapply()
    if (key === undefined || focusOptions.reveal === false) return
    pendingReveal = reveal(key) ? undefined : key
  }

  function flash(key: string): void {
    for (const element of elementsOf(key)) {
      element.classList.remove(flashClass)
      void element.offsetWidth
      element.classList.add(flashClass)
      host.setTimeout(() => element.classList.remove(flashClass), flashMilliseconds)
    }
  }

  // Imagens preguiçosas só carregam (e dão altura à página) quando se chega perto: rola até onde dá e tenta de novo até alcançar a posição.
  // Depois de alcançar, segura por um instante: o próprio site costuma rolar ao topo ao montar, e isso não pode desfazer a volta.
  function tryRestore(): void {
    if (pendingRestore === undefined) return
    const maximum = Math.max(0, host.document.documentElement.scrollHeight - host.innerHeight)
    const top = Math.min(pendingRestore, maximum)
    if (Math.abs(host.scrollY - top) > 1) host.scrollTo({ top, behavior: 'instant' })
    const now = Date.now()
    if (top >= pendingRestore && restoreHoldUntil === 0) restoreHoldUntil = now + RESTORE_HOLD_MILLISECONDS
    const isHeld = restoreHoldUntil !== 0 && now > restoreHoldUntil
    if (!isHeld && now <= restoreDeadline) return
    pendingRestore = undefined
    restoreHoldUntil = 0
    post({ type: 'scroll', top: host.scrollY })
  }

  function handleChange(): void {
    reapply()
    tryRestore()
    if (pendingRestore !== undefined) host.setTimeout(scheduleChange, RESTORE_POLL_MILLISECONDS)
    if (pendingRestore === undefined && pendingReveal !== undefined && reveal(pendingReveal)) pendingReveal = undefined
  }

  function scheduleChange(): void {
    if (frame !== 0) return
    frame = host.requestAnimationFrame(() => {
      frame = 0
      handleChange()
    })
  }

  function handleMessage(event: MessageEvent): void {
    if (event.origin !== host.location.origin || event.source !== host.parent) return
    const message = parseHostMessage(event.data, channel)
    if (message === undefined) return
    if (message.type === 'state') options.onState?.(message.payload)
    if (message.type === 'refresh') options.onRefresh?.()
    if (message.type === 'focus' && message.key !== focusedKey) focus(message.key)
    if (message.type === 'restore-scroll') {
      pendingRestore = message.top
      restoreDeadline = Date.now() + RESTORE_TIMEOUT_MILLISECONDS
      restoreHoldUntil = 0
      tryRestore()
    }
    scheduleChange()
  }

  function handleScroll(): void {
    if (pendingRestore !== undefined) return
    post({ type: 'scroll', top: host.scrollY })
  }

  function handleUserInput(): void {
    pendingRestore = undefined
    restoreHoldUntil = 0
    pendingReveal = undefined
  }

  function start(): void {
    if (!isActive || isStarted) return
    isStarted = true
    host.addEventListener('message', handleMessage)
    host.addEventListener('scroll', handleScroll, { passive: true })
    for (const name of USER_INPUT_EVENTS) host.addEventListener(name, handleUserInput, { passive: true })
    observer = new host.MutationObserver(scheduleChange)
    observer.observe(host.document.body, { childList: true, subtree: true })
    post({ type: 'ready' })
  }

  function stop(): void {
    if (!isStarted) return
    isStarted = false
    host.removeEventListener('message', handleMessage)
    host.removeEventListener('scroll', handleScroll)
    for (const name of USER_INPUT_EVENTS) host.removeEventListener(name, handleUserInput)
    observer?.disconnect()
    if (frame !== 0) host.cancelAnimationFrame(frame)
    frame = 0
  }

  function registerSection(key: string, element: HTMLElement): () => void {
    const elements = registered.get(key) ?? new Set<HTMLElement>()
    elements.add(element)
    registered.set(key, elements)
    scheduleChange()
    return () => {
      elements.delete(element)
      element.classList.remove(activeClass, flashClass)
    }
  }

  return { isActive, start, stop, registerSection, focus, flash, reapply }
}
