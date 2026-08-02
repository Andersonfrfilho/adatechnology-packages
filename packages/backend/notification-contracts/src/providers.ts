/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { CompanyId, NotificationChannel, NotificationId, UserId } from './notification.types'

export type AuthContext = {
  readonly companyId: CompanyId
  /** Ausente em rota de escopo `service`/`admin` autenticada por credencial de máquina. */
  readonly userId?: UserId
  readonly scopes: readonly string[]
}

/**
 * Identidade **já validada pelo host**. O módulo não verifica token, não conhece o emissor da
 * sessão e não decide o que é uma credencial válida (`security.md` §2) — recebe pronto e aplica
 * autorização por objeto: toda leitura de inbox filtra por `companyId` + `userId` deste contexto,
 * nunca por id vindo do cliente (BOLA/API1).
 *
 * Obrigatória quando as rotas estão ligadas; sem ela, `createNotificationModule` falha no boot.
 */
export interface AuthContextResolverPort {
  resolve(params: { readonly headers: Readonly<Record<string, string>> }): Promise<AuthContext | undefined>
}

export type ResolvedRecipient = {
  readonly email?: string
  readonly phone?: string
  readonly locale?: string
  readonly timezone?: string
  readonly displayName?: string
}

/**
 * Resolve o endereço do destinatário **no instante do envio**, a partir da tabela de usuários do
 * produto — que o módulo não conhece e nunca lê.
 *
 * É o que permite ao módulo jamais persistir e-mail ou telefone em claro: `deliveries` guarda só
 * `targetMasked`, supressão guarda HMAC, e o job na fila carrega apenas `notificationId`. Sem esta
 * porta, a única alternativa seria copiar PII para dentro do schema do pacote.
 */
export interface RecipientResolverPort {
  resolve(params: { readonly userId: UserId; readonly companyId: CompanyId }): Promise<ResolvedRecipient | undefined>
}

export type NotificationJob = {
  /** Só a referência: conteúdo e endereço ficam no banco, nunca na fila (`worker.md`). */
  readonly notificationId: NotificationId
  /**
   * A entrega específica, não só a notificação — push fan-out cria uma `delivery` por device
   * ativo, todas para o mesmo `(notificationId, channel)`; sem este id o worker não saberia qual
   * delas aquele job representa.
   */
  readonly deliveryId: string
  readonly companyId: CompanyId
  readonly channel: NotificationChannel
  readonly attempt: number
}

/**
 * Adaptadores prontos em `@adatechnology/notification-module/queue/bullmq` e `/queue/amqp` —
 * o módulo não abre conexão própria nem escolhe broker pelo host.
 */
export interface QueuePort {
  enqueue(params: { readonly job: NotificationJob; readonly delaySeconds?: number }): Promise<void>
  consume(handler: (job: NotificationJob) => Promise<void>): Promise<void>
  close(): Promise<void>
}

export type RenderTemplateParams = {
  readonly body: string
  readonly subject?: string
  readonly channel: NotificationChannel
  readonly payload: Readonly<Record<string, unknown>>
  readonly locale: string
}

export type RenderedTemplate = {
  readonly title: string
  readonly body: string
  readonly html?: string
}

/** Default do pacote interpola `{{campo}}` e escapa por canal; Handlebars/MJML é override do host. */
export interface TemplateRendererPort {
  render(params: RenderTemplateParams): Promise<RenderedTemplate> | RenderedTemplate
}

/**
 * Sem cache injetado, throttle por destinatário e nonce de webhook ficam **desligados** — e o
 * módulo diz isso no boot em vez de fingir proteção. Cachear é decisão do host, que é quem sabe
 * se o Redis dele é compartilhado entre instâncias.
 */
export interface CachePort {
  get(key: string): Promise<string | undefined>
  set(params: { readonly key: string; readonly value: string; readonly ttlSeconds: number }): Promise<void>
  increment(params: { readonly key: string; readonly ttlSeconds: number }): Promise<number>
  delete(key: string): Promise<void>
}

export type RealtimeEvent = {
  readonly event: string
  readonly data: Readonly<Record<string, unknown>>
}

export type RealtimeSubscription = {
  close(): void
}

/** Alimenta o badge em tempo real; o SSE do próprio módulo é um consumidor desta porta. */
export interface RealtimeNotifierPort {
  publish(params: {
    readonly companyId: CompanyId
    readonly userId: UserId
    readonly event: string
    readonly data: Readonly<Record<string, unknown>>
  }): Promise<void>

  /**
   * Opcional, e a consequência de omiti-la é concreta: sem `subscribe`, o SSE do módulo cai no
   * notificador em processo, que só entrega a eventos originados na **mesma instância**. Com duas
   * réplicas atrás de um balanceador, o usuário conectado na réplica A não recebe o evento que
   * nasceu na B — o badge fica parado até o próximo refetch.
   *
   * O host que roda mais de uma instância implementa esta porta sobre o pub/sub dele (Redis,
   * NATS, Postgres LISTEN/NOTIFY). Opcional porque exigi-la obrigaria quem roda instância única a
   * subir um broker que não precisa.
   */
  subscribe?(params: {
    readonly companyId: CompanyId
    readonly userId: UserId
    readonly onEvent: (event: RealtimeEvent) => void
  }): Promise<RealtimeSubscription>
}

/** Injetável para tornar determinístico o que depende de horário: quiet hours, agendamento, TTL. */
export interface ClockPort {
  now(): Date
}

export type LogMeta = Readonly<Record<string, unknown>>

export interface LoggerPort {
  debug(message: string, meta?: LogMeta): void
  info(message: string, meta?: LogMeta): void
  warn(message: string, meta?: LogMeta): void
  error(message: string, meta?: LogMeta): void
}

export interface MetricsPort {
  increment(params: { readonly metric: string; readonly labels?: Readonly<Record<string, string>> }): void
  observe(params: {
    readonly metric: string
    readonly value: number
    readonly labels?: Readonly<Record<string, string>>
  }): void
}
