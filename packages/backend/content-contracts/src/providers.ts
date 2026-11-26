/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Portas e configuração do módulo. Tudo opcional: sem storage, a capa é só URL; sem feed, as rotas
 * de RSS/Atom/sitemap não sobem. Capacidade por ausência, nunca por flag.
 */

import type { Post } from './content.types'

/**
 * Mesma forma do `ProductImageStoragePort` do catálogo, de propósito: o storage S3 que o host já
 * usa para produto (`catalog-image-storage-provider`) encaixa aqui sem adaptador.
 */
export interface ContentImageStoragePort {
  upload(params: {
    readonly buffer: Uint8Array
    readonly mimeType: string
    readonly key: string
  }): Promise<{ readonly url: string; readonly key: string }>
  delete?(key: string): Promise<void>
}

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

export const POST_EVENT = {
  CREATED: 'created',
  UPDATED: 'updated',
  PUBLISHED: 'published',
  UNPUBLISHED: 'unpublished',
  ARCHIVED: 'archived',
  REPUBLISHED: 'republished',
} as const
export type PostEventType = (typeof POST_EVENT)[keyof typeof POST_EVENT]

export type PostChangedEvent = {
  readonly type: PostEventType
  readonly post: Post
}

export type ContentHooks = {
  /**
   * Depois de cada escrita. Uso típico: purgar cache de CDN, revalidar a página estática do post,
   * avisar assinantes. Erro aqui é logado e não desfaz a escrita.
   */
  readonly onPostChanged?: (event: PostChangedEvent) => void | Promise<void>
}

export type ContentFeedConfig = {
  /** Endereço público do site, absoluto (`https://exemplo.com`). */
  readonly siteUrl: string
  readonly title: string
  readonly description?: string
  readonly language?: string
  /** Caminho do post no site, com `{slug}` e, opcional, `{shortId}` (ex.: `/novidades/{shortId}-{slug}`). Padrão: `/blog/{slug}`. */
  readonly postPathTemplate?: string
  /** Quantos posts recentes entram no feed. Padrão: 20. */
  readonly itemLimit?: number
  /** Inclui o corpo renderizado no feed (`content:encoded`). Padrão: `true`. */
  readonly includeContent?: boolean
}

export type ContentModuleConfig = {
  /**
   * Escopos aceitos nas rotas de administração. Padrão: `['content:admin']`. Lista vazia aceita
   * qualquer identidade autenticada que traga ao menos um escopo (regra do `module-http`).
   */
  readonly adminScopes?: readonly string[]
  /** Cabeçalho `Cache-Control` das respostas públicas. */
  readonly publicCacheControl?: string
  readonly feed?: ContentFeedConfig
  readonly wordsPerMinute?: number
  /** Slug automático (quando o autor não informa). Padrão: até 60 caracteres, sem palavras de ligação do pt-BR. */
  readonly slug?: { readonly maxLength?: number; readonly stopWords?: readonly string[] | false }
}

export const DEFAULT_ADMIN_SCOPES: readonly string[] = ['content:admin']
export const DEFAULT_PUBLIC_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
