/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export { createContentModule } from './ContentModule'
export type { ContentModule, ContentModuleProviders, CreateContentModuleParams } from './ContentModule'

export { createContentRoutes } from './http/routes'
export type { CreateContentRoutesParams, PublicCompanyResolverPort } from './http/routes'

export { runContentMigrations, contentMigrationsFolder, CONTENT_MIGRATIONS_TABLE } from './runMigrations'
export type { RunContentMigrationsParams } from './runMigrations'
export type { ContentDatabase, DrizzleMigrateFunction } from './database.types'

export { contentSchema, posts, recurrenceRules } from './schema/schema'
export type { PostRow, NewPostRow, RecurrenceRow, NewRecurrenceRow } from './schema/schema'

export { PostRepository } from './repositories/PostRepository'
export { RecurrenceRepository } from './repositories/RecurrenceRepository'
export type {
  PostStorePort,
  PostPage,
  PostAdminListQuery,
  PostPublicListQuery,
  RecurrenceStorePort,
  ContentDependencies,
} from './use-cases/contentModule.types'

export {
  CreatePostUseCase,
  UpdatePostUseCase,
  ArchivePostUseCase,
  PublishPostUseCase,
  UnpublishPostUseCase,
  GetPostUseCase,
  ListPostsUseCase,
} from './use-cases/Post.use-cases'
export type { PostReference } from './use-cases/Post.use-cases'
export {
  GetPublishedPostBySlugUseCase,
  ListPublishedPostsUseCase,
  ListTagsUseCase,
  TAG_SCOPE,
} from './use-cases/PublicPost.use-cases'
export type { TagScope } from './use-cases/PublicPost.use-cases'
export { UploadCoverImageUseCase } from './use-cases/UploadCoverImage.use-case'
export type { UploadCoverImageParams, UploadCoverImageResult } from './use-cases/UploadCoverImage.use-case'
export { BuildFeedUseCase, ListSitemapEntriesUseCase, FEED_FORMAT } from './use-cases/Feed.use-cases'
export type { FeedFormat } from './use-cases/Feed.use-cases'
export { COVER_IMAGE } from './shared/coverImage.constant'

export { createInMemoryPostStore } from './testing/inMemoryPostStore'

export { SaveAsTemplateUseCase, CreateFromTemplateUseCase, CountPostsUseCase } from './use-cases/Template.use-cases'
export { RepublishPostUseCase, PublishDueUseCase } from './use-cases/Scheduling.use-cases'
export type { PublishDueResult } from './use-cases/Scheduling.use-cases'
export {
  CreateRecurrenceUseCase,
  ListRecurrencesUseCase,
  UpdateRecurrenceUseCase,
  RemoveRecurrenceUseCase,
} from './use-cases/Recurrence.use-cases'
export { nextOccurrence, nextOccurrenceAfter } from './shared/recurrence'
export { startContentScheduler, DEFAULT_SCHEDULER_INTERVAL_MS } from './scheduler'
export type { StartContentSchedulerParams } from './scheduler'
export { createInMemoryRecurrenceStore } from './testing/inMemoryRecurrenceStore'
