/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export { POST_STATUS, POST_STATUSES, isPostStatus, RECURRENCE_FREQUENCY, RECURRENCE_FREQUENCIES } from './content.types'
export type {
  PostStatus,
  Post,
  PostSummary,
  PublicPost,
  PublicPostSummary,
  TagCount,
  Pagination,
  Paginated,
  PostCounts,
  RecurrenceFrequency,
  RecurrenceRule,
} from './content.types'

export {
  ContentError,
  CONTENT_ERROR_CODES,
  PostNotFoundError,
  DuplicateSlugError,
  InvalidSlugError,
  ConfigMissingError,
  InvalidCoverImageError,
  ImageStorageDisabledError,
  NotATemplateError,
  TemplateNotPublishableError,
  PostNotPublishedError,
  RepublishDateInFutureError,
  RecurrenceNotFoundError,
} from './errors'
export type { ContentErrorCode, InvalidImageReason } from './errors'

export {
  POST_LIMITS,
  slugSchema,
  httpUrlSchema,
  postFieldsSchema,
  createPostSchema,
  updatePostSchema,
  publishPostSchema,
  listPostsQuerySchema,
  listPublishedPostsQuerySchema,
  saveAsTemplateSchema,
  createFromTemplateSchema,
  republishPostSchema,
  createRecurrenceSchema,
  updateRecurrenceSchema,
} from './schemas'
export type {
  CreatePostInput,
  UpdatePostInput,
  PublishPostInput,
  ListPostsQuery,
  ListPublishedPostsQuery,
  SaveAsTemplateInput,
  CreateFromTemplateInput,
  RepublishPostInput,
  CreateRecurrenceInput,
  UpdateRecurrenceInput,
} from './schemas'

export { POST_EVENT, DEFAULT_ADMIN_SCOPES, DEFAULT_PUBLIC_CACHE_CONTROL } from './providers'
export type {
  ContentImageStoragePort,
  ClockPort,
  LoggerPort,
  LogMeta,
  PostEventType,
  PostChangedEvent,
  ContentHooks,
  ContentFeedConfig,
  ContentModuleConfig,
} from './providers'

export {
  slugify,
  isValidSlug,
  withSlugSuffix,
  buildShortSlug,
  SLUG_MAX_LENGTH,
  DEFAULT_SHORT_SLUG_LENGTH,
  PT_BR_STOP_WORDS,
} from './slugify'
export type { ShortSlugOptions } from './slugify'
export {
  buildPostRef,
  buildPostPath,
  parsePostRef,
  parsePostPath,
  isCanonicalPostRef,
  isShortId,
  SHORT_ID_LENGTH,
} from './postPath'
export type { ParsedPostRef } from './postPath'
export { normalizeTag, normalizeTags, buildTagLabels, formatTagLabel, TAG_MAX_LENGTH, TAGS_MAX_COUNT } from './tags'
export type { TagLabels } from './tags'
export { estimateReadingTimeMinutes, countWords, buildExcerpt, DEFAULT_WORDS_PER_MINUTE } from './readingTime'

export { parseMarkdown } from './markdown/parseMarkdown'
export { parseInline } from './markdown/parseInline'
export {
  renderMarkdownToHtml,
  renderMarkdownDocument,
  escapeHtml,
  resolveHeadingLevel,
  DEFAULT_LINK_REL,
} from './markdown/renderHtml'
export type { MarkdownRenderOptions } from './markdown/renderHtml'
export { markdownToPlainText, documentToPlainText, inlineToPlainText } from './markdown/plainText'
export { sanitizeLinkUrl, sanitizeImageUrl, isAbsoluteHttpUrl } from './markdown/sanitizeUrl'
export { createHeadingIdGenerator } from './markdown/headingIds'
export type { MarkdownBlock, MarkdownInline, MarkdownDocument } from './markdown/markdown.types'

export {
  buildRssFeed,
  buildAtomFeed,
  buildSitemapXml,
  buildPostUrl,
  escapeXml,
  DEFAULT_POST_PATH_TEMPLATE,
} from './feed'
export type { FeedChannel, FeedItem, SitemapEntry } from './feed'
