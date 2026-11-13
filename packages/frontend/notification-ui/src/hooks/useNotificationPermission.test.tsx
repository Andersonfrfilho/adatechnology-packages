/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  checkIsNotificationDismissed,
  readCurrentNotificationPermission,
  useNotificationPermission,
} from './useNotificationPermission'

describe('useNotificationPermission helpers', () => {
  const STORAGE_KEY = 'test:notification:permission-dismissed'

  it('readCurrentNotificationPermission devolve unsupported quando Notification nao existe', () => {
    expect(readCurrentNotificationPermission()).toBe('unsupported')
  })

  it('checkIsNotificationDismissed devolve false para storage vazio', () => {
    expect(checkIsNotificationDismissed(STORAGE_KEY, 1000)).toBe(false)
  })

  it('checkIsNotificationDismissed detecta dispensa valida e expira conforme TTL', () => {
    const mockStorage = new Map<string, string>()
    const storage: Storage = {
      getItem: (k: string) => mockStorage.get(k) ?? null,
      setItem: (k: string, v: string) => { mockStorage.set(k, v) },
      removeItem: (k: string) => { mockStorage.delete(k) },
      clear: () => { mockStorage.clear() },
      key: (i: number) => Array.from(mockStorage.keys())[i] ?? null,
      get length() { return mockStorage.size },
    }

    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: storage },
      configurable: true,
      writable: true,
    })

    // 1. Sem registro
    expect(checkIsNotificationDismissed(STORAGE_KEY, 5000)).toBe(false)

    // 2. Registro recente (dentro do TTL)
    mockStorage.set(STORAGE_KEY, JSON.stringify({ dismissedAt: Date.now() }))
    expect(checkIsNotificationDismissed(STORAGE_KEY, 5000)).toBe(true)

    // 3. Registro expirado (mais antigo que o TTL)
    mockStorage.set(STORAGE_KEY, JSON.stringify({ dismissedAt: Date.now() - 10000 }))
    expect(checkIsNotificationDismissed(STORAGE_KEY, 5000)).toBe(false)
    expect(mockStorage.has(STORAGE_KEY)).toBe(false)

    Reflect.deleteProperty(globalThis, 'window')
  })

  it('renderiza dentro de componente React sem quebrar em SSR', () => {
    function TestConsumer() {
      const state = useNotificationPermission()
      return (
        <div data-testid="status" data-supported={String(state.isSupported)}>
          {state.permission}
        </div>
      )
    }

    const html = renderToStaticMarkup(<TestConsumer />)
    expect(html).toContain('unsupported')
    expect(html).toContain('data-supported="false"')
  })
})
