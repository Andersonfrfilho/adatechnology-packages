/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type {
  ClockPort,
  ContentHooks,
  ContentImageStoragePort,
  ContentModuleConfig,
  LoggerPort,
  PostStatus,
  TagCount,
} from '@adatechnology/content-contracts'

import type { NewPostRow, PostRow } from '../schema/schema'

export type PostPage = { readonly rows: readonly PostRow[]; readonly total: number }

export type PostAdminListQuery = {
  readonly companyId: string
  readonly page: number
  readonly pageSize: number
  readonly status?: PostStatus
  readonly tag?: string
  readonly search?: string
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
  listTags(params: { readonly companyId: string; readonly publicAt?: Date }): Promise<readonly TagCount[]>
}

export type ContentDependencies = {
  readonly posts: PostStorePort
  readonly config: ContentModuleConfig
  readonly clock: ClockPort
  readonly hooks?: ContentHooks
  readonly imageStorage?: ContentImageStoragePort
  readonly logger?: LoggerPort
}
