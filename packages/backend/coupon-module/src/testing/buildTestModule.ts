/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Módulo real sobre o dublê em memória, relógio controlável e portas que gravam o que receberam.
 * Usado pelos testes de use-case e de rota; não é exportado pelo pacote.
 */

import type {
  CouponHooks,
  CouponModuleConfig,
  CustomerIdentityPort,
  LeadNotifierPort,
  LoggerPort,
  LogMeta,
} from '@adatechnology/coupon-contracts'

import { createCouponModule, type CouponModule } from '../CouponModule'
import { createInMemoryCouponPersistence } from './inMemoryPersistence'

export type TestClock = { now(): Date; set(iso: string): void }

export function createTestClock(iso = '2026-11-20T12:00:00.000Z'): TestClock {
  let current = new Date(iso)
  return {
    now: () => new Date(current),
    set: (value) => {
      current = new Date(value)
    },
  }
}

export type RecordedLog = { readonly level: string; readonly message: string; readonly meta?: LogMeta }

export function createRecordingLogger(): LoggerPort & { readonly entries: RecordedLog[] } {
  const entries: RecordedLog[] = []
  const record = (level: string) => (message: string, meta?: LogMeta) => {
    entries.push({ level, message, ...(meta ? { meta } : {}) })
  }
  return { entries, debug: record('debug'), info: record('info'), warn: record('warn'), error: record('error') }
}

export function buildTestModule(
  params: {
    config?: CouponModuleConfig
    hooks?: CouponHooks
    leadNotifier?: LeadNotifierPort
    customerIdentity?: CustomerIdentityPort
  } = {},
) {
  const persistence = createInMemoryCouponPersistence()
  const clock = createTestClock()
  const logger = createRecordingLogger()
  const module: CouponModule = createCouponModule({
    ...(params.config ? { config: params.config } : {}),
    ...(params.hooks ? { hooks: params.hooks } : {}),
    providers: {
      persistence,
      clock,
      logger,
      ...(params.leadNotifier ? { leadNotifier: params.leadNotifier } : {}),
      ...(params.customerIdentity ? { customerIdentity: params.customerIdentity } : {}),
    },
  })
  return { module, persistence, clock, logger }
}
