/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Composição raiz do módulo de conteúdo (blog, novidades, notícias). Recebe a conexão Drizzle do
 * host e devolve os use-cases; as rotas saem de `createContentRoutes` sobre este objeto.
 */

import { ConfigMissingError } from '@adatechnology/content-contracts'
import type {
  ClockPort,
  ContentHooks,
  ContentImageStoragePort,
  ContentModuleConfig,
  LoggerPort,
} from '@adatechnology/content-contracts'

import type { ContentDatabase } from './database.types'
import { PostRepository } from './repositories/PostRepository'
import { RecurrenceRepository } from './repositories/RecurrenceRepository'
import type { ContentDependencies, PostStorePort, RecurrenceStorePort } from './use-cases/contentModule.types'
import { BuildFeedUseCase, ListSitemapEntriesUseCase } from './use-cases/Feed.use-cases'
import {
  ArchivePostUseCase,
  CreatePostUseCase,
  GetPostUseCase,
  ListPostsUseCase,
  PublishPostUseCase,
  UnpublishPostUseCase,
  UpdatePostUseCase,
} from './use-cases/Post.use-cases'
import {
  GetPublishedPostBySlugUseCase,
  ListPublishedPostsUseCase,
  ListTagsUseCase,
} from './use-cases/PublicPost.use-cases'
import {
  CreateRecurrenceUseCase,
  ListRecurrencesUseCase,
  RemoveRecurrenceUseCase,
  UpdateRecurrenceUseCase,
} from './use-cases/Recurrence.use-cases'
import { PublishDueUseCase, RepublishPostUseCase } from './use-cases/Scheduling.use-cases'
import { CountPostsUseCase, CreateFromTemplateUseCase, SaveAsTemplateUseCase } from './use-cases/Template.use-cases'
import { UploadCoverImageUseCase } from './use-cases/UploadCoverImage.use-case'

export type ContentModuleProviders = {
  /** Sem storage, a capa é só por URL e a rota de upload não sobe. */
  readonly imageStorage?: ContentImageStoragePort
  /** Padrão: relógio do sistema. Os testes injetam um fixo para provar o agendamento. */
  readonly clock?: ClockPort
  readonly logger?: LoggerPort
  /** Troca a persistência (ex.: dublê em memória num teste do host). Padrão: Drizzle sobre `db`. */
  readonly postStore?: PostStorePort
  readonly recurrenceStore?: RecurrenceStorePort
}

export type CreateContentModuleParams = {
  readonly db?: ContentDatabase
  readonly config?: ContentModuleConfig
  readonly providers?: ContentModuleProviders
  readonly hooks?: ContentHooks
}

export type ContentModule = {
  readonly useCases: {
    readonly createPost: CreatePostUseCase
    readonly updatePost: UpdatePostUseCase
    readonly archivePost: ArchivePostUseCase
    readonly publishPost: PublishPostUseCase
    readonly unpublishPost: UnpublishPostUseCase
    readonly getPost: GetPostUseCase
    readonly listPosts: ListPostsUseCase
    readonly getPublishedPostBySlug: GetPublishedPostBySlugUseCase
    readonly listPublishedPosts: ListPublishedPostsUseCase
    readonly listTags: ListTagsUseCase
    readonly countPosts: CountPostsUseCase
    readonly saveAsTemplate: SaveAsTemplateUseCase
    readonly createFromTemplate: CreateFromTemplateUseCase
    readonly republishPost: RepublishPostUseCase
    readonly createRecurrence: CreateRecurrenceUseCase
    readonly listRecurrences: ListRecurrencesUseCase
    readonly updateRecurrence: UpdateRecurrenceUseCase
    readonly removeRecurrence: RemoveRecurrenceUseCase
    /** O host chama num intervalo (ver `startContentScheduler`): publica o agendado vencido e as recorrências. */
    readonly publishDue: PublishDueUseCase
    /** Capacidade por ausência: sem `providers.imageStorage`, não existe. */
    readonly uploadCoverImage?: UploadCoverImageUseCase
    /** Sem `config.feed`, feed e sitemap não existem. */
    readonly buildFeed?: BuildFeedUseCase
    readonly listSitemapEntries?: ListSitemapEntriesUseCase
  }
  readonly config: ContentModuleConfig
}

const SYSTEM_CLOCK: ClockPort = { now: () => new Date() }

function assertValidConfig(config: ContentModuleConfig): void {
  // Feed com endereço relativo geraria links quebrados em todo leitor de RSS — falha no boot.
  if (config.feed && !/^https?:\/\/[^/]/i.test(config.feed.siteUrl)) throw new ConfigMissingError('feed.siteUrl')
  if (config.feed && !config.feed.title.trim()) throw new ConfigMissingError('feed.title')
  if (config.feed?.postPathTemplate && !config.feed.postPathTemplate.includes('{slug}')) {
    throw new ConfigMissingError('feed.postPathTemplate')
  }
  if (config.wordsPerMinute !== undefined && !(config.wordsPerMinute > 0))
    throw new ConfigMissingError('wordsPerMinute')
}

export function createContentModule(params: CreateContentModuleParams): ContentModule {
  const config = params.config ?? {}
  assertValidConfig(config)

  const posts = params.providers?.postStore ?? (params.db ? new PostRepository(params.db) : undefined)
  if (!posts) throw new ConfigMissingError('db')
  const recurrences = params.providers?.recurrenceStore ?? (params.db ? new RecurrenceRepository(params.db) : undefined)
  if (!recurrences) throw new ConfigMissingError('db')

  const dependencies: ContentDependencies = {
    posts,
    recurrences,
    config,
    clock: params.providers?.clock ?? SYSTEM_CLOCK,
    ...(params.hooks ? { hooks: params.hooks } : {}),
    ...(params.providers?.imageStorage ? { imageStorage: params.providers.imageStorage } : {}),
    ...(params.providers?.logger ? { logger: params.providers.logger } : {}),
  }

  return {
    useCases: {
      createPost: new CreatePostUseCase(dependencies),
      updatePost: new UpdatePostUseCase(dependencies),
      archivePost: new ArchivePostUseCase(dependencies),
      publishPost: new PublishPostUseCase(dependencies),
      unpublishPost: new UnpublishPostUseCase(dependencies),
      getPost: new GetPostUseCase(dependencies),
      listPosts: new ListPostsUseCase(dependencies),
      getPublishedPostBySlug: new GetPublishedPostBySlugUseCase(dependencies),
      listPublishedPosts: new ListPublishedPostsUseCase(dependencies),
      listTags: new ListTagsUseCase(dependencies),
      countPosts: new CountPostsUseCase(dependencies),
      saveAsTemplate: new SaveAsTemplateUseCase(dependencies),
      createFromTemplate: new CreateFromTemplateUseCase(dependencies),
      republishPost: new RepublishPostUseCase(dependencies),
      createRecurrence: new CreateRecurrenceUseCase(dependencies),
      listRecurrences: new ListRecurrencesUseCase(dependencies),
      updateRecurrence: new UpdateRecurrenceUseCase(dependencies),
      removeRecurrence: new RemoveRecurrenceUseCase(dependencies),
      publishDue: new PublishDueUseCase(dependencies),
      ...(dependencies.imageStorage ? { uploadCoverImage: new UploadCoverImageUseCase(dependencies) } : {}),
      ...(config.feed
        ? {
            buildFeed: new BuildFeedUseCase(dependencies, config.feed),
            listSitemapEntries: new ListSitemapEntriesUseCase(dependencies, config.feed),
          }
        : {}),
    },
    config,
  }
}
