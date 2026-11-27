/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export {
  ContentProvider,
  useContentAdminApi,
  useContentPublicApi,
  useContentText,
  useRenderLink,
} from './providers/ContentProvider'
export type { ContentProviderProps, ContentText } from './providers/ContentProvider'
export type {
  ContentAdminApi,
  ContentPublicApi,
  DateTimeInputProps,
  ListPostsParams,
  ListPublishedPostsParams,
  RenderDateTimeInput,
  RenderLink,
  RenderLinkProps,
  RenderSelect,
  SelectInputProps,
} from './providers/types'

export { ContentWorkspace } from './components/ContentWorkspace'
export type { ContentWorkspaceProps } from './components/ContentWorkspace'
export { PostList } from './components/PostList'
export type { PostListProps, ListExportContext } from './components/PostList'
export { PostEditor } from './components/PostEditor'
export type { PostEditorProps } from './components/PostEditor'
export { Tooltip } from './components/Tooltip'
export type { TooltipProps } from './components/Tooltip'
export { MarkdownEditor } from './components/MarkdownEditor'
export type { MarkdownEditorProps } from './components/MarkdownEditor'
export { EmojiPicker } from './components/EmojiPicker'
export type { EmojiPickerProps } from './components/EmojiPicker'
export { FilePicker } from './components/FilePicker'
export type { FilePickerProps } from './components/FilePicker'
export { StatusChip } from './components/StatusChip'
export type { StatusChipProps } from './components/StatusChip'
export { TagsInput } from './components/TagsInput'
export type { TagsInputProps } from './components/TagsInput'

export { PostCard } from './components/PostCard'
export type { PostCardProps } from './components/PostCard'
export { PostListPage } from './components/PostListPage'
export type { PostListPageProps } from './components/PostListPage'
export { PostPage } from './components/PostPage'
export type { PostPageProps } from './components/PostPage'
export { ShareButtons } from './components/ShareButtons'
export type { ShareButtonsProps } from './components/ShareButtons'
export { MarkdownContent } from './components/MarkdownContent'
export type { MarkdownContentProps } from './components/MarkdownContent'
export { Pagination } from './components/Pagination'
export type { PaginationProps } from './components/Pagination'

// Camada headless: monte a própria tela sobre a mesma lógica.
export { usePostEditor, COVER_MAX_BYTES, COVER_MIME_TYPES } from './hooks/usePostEditor'
export type { PostEditorState, EditorFeedback, UploadImageResult } from './hooks/usePostEditor'
export { usePostList } from './hooks/usePostList'
export type { PostListFilters, PostListTab } from './hooks/usePostList'
export { parseListUrlState, serializeListUrlState, PAGE_SIZE_OPTIONS } from './lib/listUrlState'
export type { ListUrlState } from './lib/listUrlState'
export { POST_LIST_TAB } from './hooks/usePostList'
export { useUnsavedChangesGuard } from './hooks/useUnsavedChangesGuard'
export { useAsyncResource } from './hooks/useAsyncResource'
export type { AsyncResource } from './hooks/useAsyncResource'

export { buildShareLinks, SHARE_NETWORK, SHARE_NETWORKS } from './lib/share'
export type { ShareNetwork, ShareLink } from './lib/share'
export { buildPostMeta } from './lib/seo'
export type { PostMeta } from './lib/seo'
export { formatPostDate, toDateTimeLocalValue, fromDateTimeLocalValue } from './lib/format'
export { insertImage, insertLink, insertText, toggleLinePrefix, toggleWrap } from './lib/markdownFormat'
export type { LinePrefixKind, TextSelection } from './lib/markdownFormat'
export { searchEmoji, EMOJI_BY_CATEGORY, EMOJI_CATEGORIES } from './lib/emoji'
export { buildPageItems } from './lib/pagination'
export type { PageItem } from './lib/pagination'
export {
  draftFromPost,
  draftToInput,
  isDraftDirty,
  deriveSlug,
  validateDraft,
  splitTagInput,
  EMPTY_POST_DRAFT,
  DRAFT_ERROR,
} from './lib/postDraft'
export type { PostDraft, DraftErrorField } from './lib/postDraft'

export { resolveContentMessages, interpolate, DEFAULT_CONTENT_LOCALE } from './locales'
export type { ContentMessages, ContentLocale } from './locales'
