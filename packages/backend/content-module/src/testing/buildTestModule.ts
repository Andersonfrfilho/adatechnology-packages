/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Monta o módulo real sobre o dublê em memória e um relógio controlável — usado pelos testes de
 * use-case e de rota. Não é exportado pelo pacote.
 */

import type { ContentHooks, ContentImageStoragePort, ContentModuleConfig } from '@adatechnology/content-contracts'

import { createContentModule, type ContentModule } from '../ContentModule'
import { createInMemoryPostStore } from './inMemoryPostStore'
import { createInMemoryRecurrenceStore } from './inMemoryRecurrenceStore'

export type TestClock = { now(): Date; set(iso: string): void; advanceMinutes(minutes: number): void }

export function createTestClock(iso = '2026-11-20T12:00:00.000Z'): TestClock {
  let current = new Date(iso)
  return {
    now: () => new Date(current),
    set: (value) => {
      current = new Date(value)
    },
    advanceMinutes: (minutes) => {
      current = new Date(current.getTime() + minutes * 60_000)
    },
  }
}

export function buildTestModule(
  params: {
    config?: ContentModuleConfig
    hooks?: ContentHooks
    imageStorage?: ContentImageStoragePort
  } = {},
): {
  module: ContentModule
  store: ReturnType<typeof createInMemoryPostStore>
  recurrenceStore: ReturnType<typeof createInMemoryRecurrenceStore>
  clock: TestClock
} {
  const store = createInMemoryPostStore()
  const recurrenceStore = createInMemoryRecurrenceStore()
  const clock = createTestClock()
  const module = createContentModule({
    ...(params.config ? { config: params.config } : {}),
    ...(params.hooks ? { hooks: params.hooks } : {}),
    providers: {
      postStore: store,
      recurrenceStore,
      clock,
      ...(params.imageStorage ? { imageStorage: params.imageStorage } : {}),
    },
  })
  return { module, store, recurrenceStore, clock }
}
