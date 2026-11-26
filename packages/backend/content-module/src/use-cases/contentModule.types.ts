/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type {
  ClockPort,
  ContentHooks,
  ContentImageStoragePort,
  ContentModuleConfig,
  LoggerPort,
  PostCounts,
  PostStatus,
  TagCount,
} from '@adatechnology/content-contracts'

import type { NewPostRow, PostRow, NewRecurrenceRow, RecurrenceRow } from '../schema/schema'

export type PostPage = { readonly rows: readonly PostRow[]; readonly total: number }

export type PostAdminListQuery = {
  readonly companyId: string
  readonly page: number
  readonly pageSize: number
  readonly status?: PostStatus
  readonly tag?: string
  readonly search?: string
  readonly isTemplate?: boolean
  readonly now: Date
}

export type PostPublicListQuery = {
  readonly companyId: string
  readonly now: Date
  readonly page: number
  readonly pageSize: number
  readonly tag?: string
}

/**
 * Porta de persistência dos use-cases. `PostRepository` é a implementação Drizzle; os testes usam
 * o dublê em memória de `testing/`. Toda operação recebe `companyId` — não existe leitura sem empresa.
 */
export interface PostStorePort {
  create(values: NewPostRow): Promise<PostRow>
  findById(params: { readonly companyId: string; readonly id: string }): Promise<PostRow | undefined>
  findBySlug(params: { readonly companyId: string; readonly slug: string }): Promise<PostRow | undefined>
  findByShortId(params: { readonly companyId: string; readonly shortId: string }): Promise<PostRow | undefined>
  findPublicByShortId(params: {
    readonly companyId: string
    readonly shortId: string
    readonly now: Date
  }): Promise<PostRow | undefined>
  /** Post público que já teve este slug (link antigo). */
  findPublicByFormerSlug(params: {
    readonly companyId: string
    readonly slug: string
    readonly now: Date
  }): Promise<PostRow | undefined>
  recordFormerSlug(params: {
    readonly companyId: string
    readonly postId: string
    readonly slug: string
  }): Promise<void>
  findPublicBySlug(params: {
    readonly companyId: string
    readonly slug: string
    readonly now: Date
  }): Promise<PostRow | undefined>
  update(params: {
    readonly companyId: string
    readonly id: string
    readonly values: Partial<NewPostRow>
  }): Promise<PostRow | undefined>
  listForAdmin(query: PostAdminListQuery): Promise<PostPage>
  listPublic(query: PostPublicListQuery): Promise<PostPage>
  countByStatus(params: { readonly companyId: string; readonly now: Date }): Promise<PostCounts>
  /**
   * Marca como publicado (sem tocar `updated_at`) até `limit` posts agendados vencidos, de qualquer
   * empresa, e devolve só o que ESTA chamada marcou. Atômico e seguro com execuções concorrentes
   * (`FOR UPDATE SKIP LOCKED` no Postgres): dois ciclos nunca marcam nem notificam o mesmo post.
   */
  claimDueScheduled(params: { readonly now: Date; readonly limit: number }): Promise<readonly PostRow[]>
  listTags(params: { readonly companyId: string; readonly publicAt?: Date }): Promise<readonly TagCount[]>
}

/** Persistência das regras de recorrência. Mesma regra: toda operação do painel recebe `companyId`. */
export interface RecurrenceStorePort {
  create(values: NewRecurrenceRow): Promise<RecurrenceRow>
  findById(params: { readonly companyId: string; readonly id: string }): Promise<RecurrenceRow | undefined>
  list(params: { readonly companyId: string }): Promise<readonly RecurrenceRow[]>
  update(params: {
    readonly companyId: string
    readonly id: string
    readonly values: Partial<NewRecurrenceRow>
  }): Promise<RecurrenceRow | undefined>
  remove(params: { readonly companyId: string; readonly id: string }): Promise<boolean>
  /**
   * Trava (`FOR UPDATE SKIP LOCKED`) até `limit` regras ativas vencidas, de qualquer empresa, e roda
   * `handle` para cada uma na mesma transação: o que `handle` devolver vira o novo estado da regra.
   * Falha em `handle` desfaz só a regra dela e a deixa vencida para o próximo ciclo.
   */
  processDue(params: {
    readonly now: Date
    readonly limit: number
    readonly handle: (rule: RecurrenceRow) => Promise<Partial<NewRecurrenceRow>>
  }): Promise<number>
}

export type ContentDependencies = {
  readonly posts: PostStorePort
  readonly recurrences: RecurrenceStorePort
  readonly config: ContentModuleConfig
  readonly clock: ClockPort
  readonly hooks?: ContentHooks
  readonly imageStorage?: ContentImageStoragePort
  readonly logger?: LoggerPort
}
