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

export { contentSchema, posts } from './schema/schema'
export type { PostRow, NewPostRow } from './schema/schema'

export { PostRepository } from './repositories/PostRepository'
export type {
  PostStorePort,
  PostPage,
  PostAdminListQuery,
  PostPublicListQuery,
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
