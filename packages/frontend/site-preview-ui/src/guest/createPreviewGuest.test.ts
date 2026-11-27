/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Janela falsa mínima: o guest só usa ouvintes, `parent.postMessage`, o documento, `scrollTo` e o observador de mutações.
 */

import { describe, expect, it } from 'bun:test'

import { wrapHostMessage, type HostMessage } from '../protocol'

import { createPreviewGuest } from './createPreviewGuest'

const ORIGIN = 'http://site.test'

type FakeElement = {
  readonly key: string
  readonly classes: Set<string>
  top: number
  height: number
  readonly classList: { add: (name: string) => void; remove: (...names: string[]) => void }
  readonly offsetWidth: number
  getClientRects: () => number[]
  getBoundingClientRect: () => { top: number; height: number }
}

function createElement(key: string, top: number, height: number): FakeElement {
  const classes = new Set<string>()
  return {
    key,
    classes,
    top,
    height,
    offsetWidth: 0,
    classList: {
      add: (name) => classes.add(name),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
    },
    getClientRects: () => [1],
    getBoundingClientRect() {
      return { top: this.top - fake.scrollY, height: this.height }
    },
  } as FakeElement
}

const fake = { scrollY: 0 }

function createFakeWindow(elements: FakeElement[], documentHeight: number) {
  fake.scrollY = 0
  const listeners = new Map<string, Array<(event: unknown) => void>>()
  const posted: unknown[] = []
  const scrolls: number[] = []
  let mutationCallback: () => void = () => undefined
  const parent = { postMessage: (data: unknown) => posted.push(data) }
  const host = {
    parent,
    location: { origin: ORIGIN },
    innerHeight: 800,
    get scrollY() {
      return fake.scrollY
    },
    document: {
      body: {},
      documentElement: { scrollHeight: documentHeight },
      querySelectorAll: (selector: string) => {
        const attribute = /\[data-preview-field="(.+)"\]/.exec(selector)
        if (attribute) return elements.filter((element) => element.key === attribute[1])
        return elements.filter((element) => element.classes.has(selector.slice(1)))
      },
    },
    addEventListener: (name: string, listener: (event: unknown) => void) =>
      listeners.set(name, [...(listeners.get(name) ?? []), listener]),
    removeEventListener: (name: string) => listeners.delete(name),
    scrollTo: (options: { top: number }) => {
      fake.scrollY = options.top
      scrolls.push(options.top)
    },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (callback: () => void) => {
      callback()
      return 0
    },
    cancelAnimationFrame: () => undefined,
    setTimeout: () => 0,
    MutationObserver: class {
      constructor(callback: () => void) {
        mutationCallback = callback
      }
      observe() {}
      disconnect() {}
    },
  }
  const dispatch = (name: string, event: unknown = {}) =>
    (listeners.get(name) ?? []).forEach((listener) => listener(event))
  const send = (message: HostMessage, overrides: { origin?: string; source?: unknown } = {}) =>
    dispatch('message', {
      origin: overrides.origin ?? ORIGIN,
      source: 'source' in overrides ? overrides.source : parent,
      data: wrapHostMessage('ada-site-preview', message),
    })
  return {
    host: host as unknown as Window & typeof globalThis,
    send,
    dispatch,
    posted,
    scrolls,
    notifyMutation: () => mutationCallback(),
  }
}

describe('createPreviewGuest', () => {
  it('avisa que está pronto e rola até a seção da chave, destacando', () => {
    const photos = createElement('photos.gallery', 2400, 500)
    const tagline = createElement('tagline', 200, 40)
    const env = createFakeWindow([photos, tagline], 6000)
    const guest = createPreviewGuest({ window: env.host })
    guest.start()
    expect(env.posted).toHaveLength(1)
    env.send({ type: 'focus', key: 'photos.gallery' })
    expect(env.scrolls).toEqual([2400 - 150])
    expect(photos.classes.has('preview-active')).toBe(true)
    env.send({ type: 'focus', key: 'tagline' })
    expect(photos.classes.has('preview-active')).toBe(false)
    expect(tagline.classes.has('preview-active')).toBe(true)
    expect(env.scrolls).toEqual([2250, 0])
  })

  it('mesma chave de novo não rola outra vez (salvar não pula a página)', () => {
    const gallery = createElement('photos.gallery', 2400, 500)
    const env = createFakeWindow([gallery], 6000)
    createPreviewGuest({ window: env.host }).start()
    env.send({ type: 'focus', key: 'photos.gallery' })
    env.send({ type: 'state', payload: { saved: true } })
    env.send({ type: 'focus', key: 'photos.gallery' })
    expect(env.scrolls).toHaveLength(1)
  })

  it('chaves diferentes (abertura e galeria) levam a seções diferentes', () => {
    const hero = createElement('photos.hero', 0, 700)
    const gallery = createElement('photos.gallery', 3000, 600)
    const env = createFakeWindow([hero, gallery], 6000)
    createPreviewGuest({ window: env.host }).start()
    env.send({ type: 'focus', key: 'photos.gallery' })
    expect(fake.scrollY).toBeGreaterThan(2000)
    env.send({ type: 'focus', key: 'photos.hero' })
    expect(fake.scrollY).toBe(0)
  })

  it('espera a seção aparecer quando o conteúdo ainda não carregou', () => {
    const elements: FakeElement[] = []
    const env = createFakeWindow(elements, 6000)
    createPreviewGuest({ window: env.host }).start()
    env.send({ type: 'focus', key: 'values' })
    expect(env.scrolls).toHaveLength(0)
    elements.push(createElement('values', 1800, 400))
    env.notifyMutation()
    expect(env.scrolls).toEqual([1800 - 200])
  })

  it('devolve a rolagem guardada depois de recarregar, quando a página já tem altura', () => {
    const elements: FakeElement[] = []
    const documentHeight = { value: 500 }
    const env = createFakeWindow(elements, 500)
    ;(env.host.document.documentElement as { scrollHeight: number }).scrollHeight = documentHeight.value
    createPreviewGuest({ window: env.host }).start()
    env.send({ type: 'restore-scroll', top: 1500 })
    expect(env.scrolls).toHaveLength(0)
    ;(env.host.document.documentElement as { scrollHeight: number }).scrollHeight = 4000
    env.notifyMutation()
    expect(env.scrolls).toEqual([1500])
  })

  it('não reporta a rolagem enquanto restaura (não sobrescreve o valor guardado com 0)', () => {
    const env = createFakeWindow([], 500)
    createPreviewGuest({ window: env.host }).start()
    env.send({ type: 'restore-scroll', top: 1500 })
    env.dispatch('scroll')
    expect(env.posted).toHaveLength(1)
    env.dispatch('wheel')
    env.dispatch('scroll')
    expect(env.posted).toHaveLength(2)
  })

  it('ignora mensagem de outra origem ou de outra janela', () => {
    const gallery = createElement('photos.gallery', 2400, 500)
    const env = createFakeWindow([gallery], 6000)
    createPreviewGuest({ window: env.host }).start()
    env.send({ type: 'focus', key: 'photos.gallery' }, { origin: 'http://evil.test' })
    env.send({ type: 'focus', key: 'photos.gallery' }, { source: {} })
    expect(env.scrolls).toHaveLength(0)
  })

  it('entrega o rascunho e o pedido de recarga ao site', () => {
    const received: unknown[] = []
    let refreshed = 0
    const env = createFakeWindow([], 600)
    createPreviewGuest({
      window: env.host,
      onState: (payload) => received.push(payload),
      onRefresh: () => {
        refreshed += 1
      },
    }).start()
    env.send({ type: 'state', payload: { tagline: 'oi' } })
    env.send({ type: 'refresh' })
    expect(received).toEqual([{ tagline: 'oi' }])
    expect(refreshed).toBe(1)
  })

  it('seção registrada à mão também recebe o destaque', () => {
    const custom = createElement('custom', 3000, 300)
    const env = createFakeWindow([], 6000)
    const guest = createPreviewGuest({ window: env.host })
    guest.start()
    const unregister = guest.registerSection('custom', custom as unknown as HTMLElement)
    env.send({ type: 'focus', key: 'custom' })
    expect(custom.classes.has('preview-active')).toBe(true)
    unregister()
    expect(custom.classes.has('preview-active')).toBe(false)
  })

  it('fora de um iframe não faz nada', () => {
    const env = createFakeWindow([], 600)
    const standalone = { ...env.host, parent: undefined } as unknown as Window & typeof globalThis
    ;(standalone as unknown as { parent: unknown }).parent = standalone
    const guest = createPreviewGuest({ window: standalone })
    guest.start()
    expect(guest.isActive).toBe(false)
    expect(env.posted).toHaveLength(0)
  })
})
