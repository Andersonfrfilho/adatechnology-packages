/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O pacote não faz `fetch`: o host implementa estas interfaces (sobre as rotas do
 * `content-module`, um BFF, ou o que tiver) e injeta no `ContentProvider`.
 */

import type {
  CreatePostInput,
  Paginated,
  Post,
  PostStatus,
  PostSummary,
  PublicPost,
  PublicPostSummary,
  PublishPostInput,
  TagCount,
  UpdatePostInput,
} from '@adatechnology/content-contracts'
import type { ReactNode } from 'react'

export type ListPostsParams = {
  readonly page?: number
  readonly pageSize?: number
  readonly status?: PostStatus
  readonly tag?: string
  readonly search?: string
}

export type ContentAdminApi = {
  listPosts(params: ListPostsParams): Promise<Paginated<PostSummary>>
  getPost(id: string): Promise<Post>
  createPost(input: CreatePostInput): Promise<Post>
  updatePost(id: string, input: UpdatePostInput): Promise<Post>
  publishPost(id: string, input?: PublishPostInput): Promise<Post>
  unpublishPost(id: string): Promise<Post>
  archivePost(id: string): Promise<void>
  /** Ausente: o filtro de tag vira campo livre e o editor não sugere tags. */
  listTags?(): Promise<readonly TagCount[]>
  /** Ausente: a capa é só por URL — sem alvo de upload que sempre falharia. */
  uploadCoverImage?(file: File): Promise<{ readonly url: string; readonly key: string }>
}

export type ListPublishedPostsParams = {
  readonly page?: number
  readonly pageSize?: number
  readonly tag?: string
}

export type ContentPublicApi = {
  listPublishedPosts(params: ListPublishedPostsParams): Promise<Paginated<PublicPostSummary>>
  /** Rejeita (ou resolve `undefined`) quando o post não existe ou não está no ar. */
  getPublishedPost(slug: string): Promise<PublicPost | undefined>
  /** Ausente: a página de lista não mostra o filtro de tags. */
  listTags?(): Promise<readonly TagCount[]>
}

export type RenderLinkProps = {
  readonly href: string
  readonly className?: string
  readonly children: ReactNode
  readonly 'aria-current'?: 'page'
  readonly 'aria-label'?: string
  readonly rel?: string
}

/** Troca o `<a>` pelo `Link` do roteador do host (Next, React Router…) sem o pacote conhecê-lo. */
export type RenderLink = (props: RenderLinkProps) => ReactNode

export type DateTimeInputProps = {
  readonly id: string
  readonly label: string
  /** Formato `YYYY-MM-DDTHH:mm` (hora local, 24h), ou vazio. */
  readonly value: string
  readonly onChange: (value: string) => void
}

/** Troca o `<input type="datetime-local">` nativo pelo seletor de data e hora do host. */
export type RenderDateTimeInput = (props: DateTimeInputProps) => ReactNode
