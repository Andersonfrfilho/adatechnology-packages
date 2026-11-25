/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Toda a lógica do editor: carregar, rascunho local, slug automático, validação, salvar,
 * publicar/agendar/despublicar/arquivar e envio de capa. O componente só desenha.
 */

import type { Post, TagCount } from '@adatechnology/content-contracts'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { fromDateTimeLocalValue, toDateTimeLocalValue } from '../lib/format'
import { deriveSlug, draftFromPost, draftToInput, isDraftDirty, validateDraft, type PostDraft } from '../lib/postDraft'
import { useContentAdminApi } from '../providers/ContentProvider'
import { useAsyncResource } from './useAsyncResource'

export const COVER_MAX_BYTES = 1024 * 1024
export const COVER_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']

export type EditorFeedback =
  'saved' | 'saveError' | 'coverTooLarge' | 'coverInvalidType' | 'coverUploadError' | 'errorSchedule'

export function usePostEditor(params: {
  readonly postId?: string
  readonly defaults?: Partial<PostDraft>
  readonly onSaved?: (post: Post) => void
  readonly onArchived?: (post: Post) => void
}) {
  const api = useContentAdminApi()
  const [post, setPost] = useState<Post | undefined>()
  const [isLoading, setIsLoading] = useState(Boolean(params.postId))
  const [baseline, setBaseline] = useState<PostDraft>(() => draftFromPost(undefined, params.defaults))
  const [draft, setDraft] = useState<PostDraft>(baseline)
  const [slugTouched, setSlugTouched] = useState(Boolean(params.postId))
  const [scheduleAt, setScheduleAt] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [feedback, setFeedback] = useState<EditorFeedback | undefined>()
  const [showErrors, setShowErrors] = useState(false)
  const tags = useAsyncResource<readonly TagCount[]>(
    () => (api.listTags ? api.listTags() : Promise.resolve([])),
    'editor-tags',
  )

  // Só setters (estáveis): a identidade não muda, e o efeito de carga pode depender dela.
  const accept = useCallback((saved: Post): void => {
    const next = draftFromPost(saved)
    setPost(saved)
    setBaseline(next)
    setDraft(next)
    setSlugTouched(true)
    setScheduleAt(saved.status === 'scheduled' ? toDateTimeLocalValue(saved.publishedAt) : '')
  }, [])

  useEffect(() => {
    if (!params.postId) return undefined
    let isCurrent = true
    setIsLoading(true)
    api
      .getPost(params.postId)
      .then((loaded) => {
        if (!isCurrent) return
        accept(loaded)
        setIsLoading(false)
      })
      .catch(() => {
        if (isCurrent) setIsLoading(false)
      })
    return () => {
      isCurrent = false
    }
  }, [params.postId, api, accept])

  const errors = useMemo(() => validateDraft(draft), [draft])
  const isDirty = isDraftDirty(draft, baseline)
  const isValid = Object.keys(errors).length === 0

  function update<TKey extends keyof PostDraft>(field: TKey, value: PostDraft[TKey]): void {
    setFeedback(undefined)
    setDraft((current) => {
      const next = { ...current, [field]: value }
      if (field === 'title' && !post)
        return { ...next, slug: deriveSlug({ title: next.title, slug: next.slug, slugTouched }) }
      return next
    })
    if (field === 'slug') setSlugTouched(true)
  }

  async function run(action: () => Promise<Post>): Promise<Post | undefined> {
    setShowErrors(true)
    if (!isValid) return undefined
    setIsBusy(true)
    try {
      const saved = await action()
      accept(saved)
      setFeedback('saved')
      params.onSaved?.(saved)
      return saved
    } catch {
      setFeedback('saveError')
      return undefined
    } finally {
      setIsBusy(false)
    }
  }

  async function persist(): Promise<Post> {
    const input = draftToInput(draft)
    if (!post) return api.createPost(input)
    if (!isDirty) return post
    return api.updatePost(post.id, input)
  }

  const save = () => run(persist)
  const publishNow = () => run(async () => api.publishPost((await persist()).id))
  const schedule = () => {
    const publishedAt = fromDateTimeLocalValue(scheduleAt)
    if (!publishedAt) {
      setFeedback('errorSchedule')
      return Promise.resolve(undefined)
    }
    return run(async () => api.publishPost((await persist()).id, { publishedAt }))
  }
  const unpublish = () => run(async () => api.unpublishPost((await persist()).id))

  async function archive(): Promise<void> {
    if (!post) return
    setIsBusy(true)
    try {
      await api.archivePost(post.id)
      const archived = { ...post, status: 'archived' as const }
      setPost(archived)
      params.onArchived?.(archived)
    } catch {
      setFeedback('saveError')
    } finally {
      setIsBusy(false)
    }
  }

  async function uploadCover(file: File): Promise<void> {
    if (!api.uploadCoverImage) return
    if (!COVER_MIME_TYPES.includes(file.type)) return setFeedback('coverInvalidType')
    if (file.size > COVER_MAX_BYTES) return setFeedback('coverTooLarge')
    setIsUploading(true)
    try {
      const { url } = await api.uploadCoverImage(file)
      update('coverImageUrl', url)
    } catch {
      setFeedback('coverUploadError')
    } finally {
      setIsUploading(false)
    }
  }

  return {
    post,
    draft,
    update,
    errors: showErrors ? errors : {},
    isLoading,
    isDirty,
    isBusy,
    isUploading,
    feedback,
    scheduleAt,
    setScheduleAt,
    canUploadCover: Boolean(api.uploadCoverImage),
    tagSuggestions: (tags.data ?? []).map((entry) => entry.tag),
    save,
    publishNow,
    schedule,
    unpublish,
    archive,
    uploadCover,
  }
}

export type PostEditorState = ReturnType<typeof usePostEditor>
