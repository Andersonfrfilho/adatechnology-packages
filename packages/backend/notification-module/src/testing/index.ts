/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Dublês para o host testar o próprio wiring sem rede, banco nem broker — o mesmo ferramental
 * que a suíte deste pacote usa. Exportado em `@adatechnology/notification-module/testing`, para
 * não entrar no bundle de produção de quem só importa o módulo.
 */

import type {
  CachePort,
  DeliveryAttemptResult,
  EmailDriverPort,
  NotificationJob,
  PushDriverPort,
  QueuePort,
  RecipientResolverPort,
  SendEmailParams,
  SendPushParams,
  SendWhatsAppParams,
  WhatsAppDriverPort,
} from '@adatechnology/notification-contracts'

export type RecordedPush = SendPushParams
export type RecordedEmail = SendEmailParams
export type RecordedWhatsApp = SendWhatsAppParams

export type InMemoryPushDriver = PushDriverPort & { readonly sent: RecordedPush[] }
export type InMemoryEmailDriver = EmailDriverPort & { readonly sent: RecordedEmail[] }
export type InMemoryWhatsAppDriver = WhatsAppDriverPort & { readonly sent: RecordedWhatsApp[] }

/** `outcome` fixo por construção — é assim que o teste do host força retry, token morto etc. */
export function createInMemoryPushDriver(outcome: DeliveryAttemptResult = { outcome: 'sent' }): InMemoryPushDriver {
  const sent: RecordedPush[] = []
  return {
    driver: 'expo',
    sent,
    async send(params) {
      sent.push(params)
      return outcome
    },
  }
}

export function createInMemoryEmailDriver(outcome: DeliveryAttemptResult = { outcome: 'sent' }): InMemoryEmailDriver {
  const sent: RecordedEmail[] = []
  return {
    driver: 'smtp',
    sent,
    async send(params) {
      sent.push(params)
      return outcome
    },
  }
}

export function createInMemoryWhatsAppDriver(
  outcome: DeliveryAttemptResult = { outcome: 'sent' },
): InMemoryWhatsAppDriver {
  const sent: RecordedWhatsApp[] = []
  return {
    sent,
    async send(params) {
      sent.push(params)
      return outcome
    },
  }
}

export type ControllableQueue = QueuePort & {
  readonly pending: NotificationJob[]
  /** Processa a fila manualmente — o teste controla QUANDO o job roda, sem timer nem espera. */
  drain(): Promise<void>
}

export function createControllableQueue(): ControllableQueue {
  const pending: NotificationJob[] = []
  let handler: ((job: NotificationJob) => Promise<void>) | undefined

  return {
    pending,
    async enqueue({ job }) {
      pending.push(job)
    },
    async consume(jobHandler) {
      handler = jobHandler
    },
    async close() {
      handler = undefined
    },
    async drain() {
      if (!handler) throw new Error('notification-module/testing: chame consume() antes de drain()')
      const jobs = pending.splice(0, pending.length)
      for (const job of jobs) {
        await handler(job)
      }
    },
  }
}

export function createInMemoryCache(): CachePort {
  const store = new Map<string, string>()
  const counters = new Map<string, number>()

  return {
    async get(key) {
      return store.get(key)
    },
    async set({ key, value }) {
      store.set(key, value)
    },
    async increment({ key }) {
      const next = (counters.get(key) ?? 0) + 1
      counters.set(key, next)
      return next
    },
    async delete(key) {
      store.delete(key)
      counters.delete(key)
    },
  }
}

export function createStaticRecipientResolver(recipient: {
  email?: string
  phone?: string
  locale?: string
  timezone?: string
  displayName?: string
}): RecipientResolverPort {
  return {
    async resolve() {
      return recipient
    },
  }
}

export function createFixedClock(now: Date): { now(): Date } {
  return { now: () => now }
}
