/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Post } from '@adatechnology/content-contracts'
import { Archive, ArrowLeft, CalendarClock, EyeOff, ImageUp, Save, Send, Trash2 } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

import { usePostEditor } from '../hooks/usePostEditor'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import { formatPostDate } from '../lib/format'
import type { PostDraft } from '../lib/postDraft'
import { useContentText } from '../providers/ContentProvider'
import { MarkdownContent } from './MarkdownContent'
import { StatusChip } from './StatusChip'
import { TagsInput } from './TagsInput'

export type PostEditorProps = {
  /** Ausente: post novo. */
  readonly postId?: string
  /** Valores iniciais de um post novo (ex.: `authorName` do usuário logado). */
  readonly defaults?: Partial<PostDraft>
  readonly onSaved?: (post: Post) => void
  readonly onArchived?: (post: Post) => void
  /** Ausente: sem botão Voltar. Só é chamado depois de confirmar alterações não salvas. */
  readonly onClose?: () => void
}

type FieldProps = {
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly error?: string | undefined
  readonly hint?: string
  readonly type?: 'text' | 'url'
  readonly multiline?: boolean
  readonly maxLength?: number
}

function TextField({ label, value, onChange, error, hint, type = 'text', multiline, maxLength }: FieldProps) {
  const id = useId()
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  const common = {
    id,
    value,
    maxLength,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  }
  return (
    <div className="adc-field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea {...common} rows={3} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input {...common} type={type} onChange={(event) => onChange(event.target.value)} />
      )}
      {hint && (
        <small id={`${id}-hint`} className="adc-hint">
          {hint}
        </small>
      )}
      {error && (
        <small id={`${id}-error`} className="adc-error">
          {error}
        </small>
      )}
    </div>
  )
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <fieldset className="adc-section">
      <legend>{title}</legend>
      {children}
    </fieldset>
  )
}

export function PostEditor({ postId, defaults, onSaved, onArchived, onClose }: PostEditorProps) {
  const { messages, locale, format } = useContentText()
  const editor = usePostEditor({
    ...(postId ? { postId } : {}),
    ...(defaults ? { defaults } : {}),
    ...(onSaved ? { onSaved } : {}),
    ...(onArchived ? { onArchived } : {}),
  })
  const { confirmLeave } = useUnsavedChangesGuard(editor.isDirty, messages.unsavedConfirm)
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const bodyId = useId()
  const scheduleId = useId()
  const { draft, update, errors, post } = editor

  if (editor.isLoading) {
    return (
      <p className="adc-root adc-state" role="status">
        {messages.loading}
      </p>
    )
  }

  const status = post?.status
  const isLive = status === 'published' || status === 'scheduled'

  return (
    <form
      className="adc-root adc-editor"
      onSubmit={(event) => {
        event.preventDefault()
        void editor.save()
      }}
    >
      <header className="adc-toolbar">
        {onClose && (
          <button type="button" className="adc-button adc-button--ghost" onClick={() => confirmLeave() && onClose()}>
            <ArrowLeft aria-hidden="true" className="adc-icon" />
            {messages.close}
          </button>
        )}
        <h2 className="adc-title">{post ? messages.editorEditTitle : messages.editorNewTitle}</h2>
        {status && <StatusChip status={status} />}
        {editor.isDirty && <span className="adc-badge">{messages.unsavedBadge}</span>}
      </header>

      <div className="adc-editor-grid">
        <div className="adc-editor-main">
          <TextField
            label={messages.fieldTitle}
            value={draft.title}
            maxLength={200}
            onChange={(value) => update('title', value)}
            error={errors.title ? messages.errorTitle : undefined}
          />
          <TextField
            label={messages.fieldSlug}
            value={draft.slug}
            maxLength={120}
            hint={messages.fieldSlugHint}
            onChange={(value) => update('slug', value.toLowerCase())}
            error={errors.slug ? messages.errorSlug : undefined}
          />
          <TextField
            label={messages.fieldExcerpt}
            value={draft.excerpt}
            maxLength={500}
            multiline
            onChange={(value) => update('excerpt', value)}
          />

          <div className="adc-field">
            <div className="adc-tabs" role="tablist" aria-label={messages.fieldBody}>
              <span className="adc-label" id={`${bodyId}-label`}>
                {messages.fieldBody}
              </span>
              {(['write', 'preview'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  aria-controls={`${bodyId}-${value}`}
                  className="adc-tab"
                  onClick={() => setTab(value)}
                >
                  {value === 'write' ? messages.tabWrite : messages.tabPreview}
                </button>
              ))}
            </div>
            <div className={`adc-body-panes adc-body-panes--${tab}`}>
              <div id={`${bodyId}-write`} role="tabpanel" className="adc-pane adc-pane--write">
                <textarea
                  aria-labelledby={`${bodyId}-label`}
                  aria-describedby={`${bodyId}-hint`}
                  className="adc-markdown-input"
                  value={draft.body}
                  onChange={(event) => update('body', event.target.value)}
                />
                <small id={`${bodyId}-hint`} className="adc-hint">
                  {messages.bodyHint}
                </small>
              </div>
              <div id={`${bodyId}-preview`} role="tabpanel" className="adc-pane adc-pane--preview" aria-live="polite">
                {draft.body.trim() ? (
                  <MarkdownContent markdown={draft.body} headingLevelOffset={1} />
                ) : (
                  <p className="adc-muted">{messages.previewEmpty}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="adc-editor-side">
          <Section title={messages.publishSection}>
            {post?.publishedAt && (
              <p className="adc-muted">
                {format(status === 'scheduled' ? 'scheduledFor' : 'publishedOn', {
                  date: formatPostDate(post.publishedAt, locale, true),
                })}
              </p>
            )}
            <button type="submit" className="adc-button" disabled={editor.isBusy}>
              <Save aria-hidden="true" className="adc-icon" />
              {editor.isBusy ? messages.saving : isLive ? messages.saveChanges : messages.save}
            </button>
            {status !== 'published' && (
              <button
                type="button"
                className="adc-button adc-button--primary"
                disabled={editor.isBusy}
                onClick={() => void editor.publishNow()}
              >
                <Send aria-hidden="true" className="adc-icon" />
                {messages.publishNow}
              </button>
            )}
            <div className="adc-field">
              <label htmlFor={scheduleId}>{messages.scheduleAt}</label>
              <input
                id={scheduleId}
                type="datetime-local"
                value={editor.scheduleAt}
                onChange={(event) => editor.setScheduleAt(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="adc-button"
              disabled={editor.isBusy || !editor.scheduleAt}
              onClick={() => void editor.schedule()}
            >
              <CalendarClock aria-hidden="true" className="adc-icon" />
              {messages.schedule}
            </button>
            {isLive && (
              <button
                type="button"
                className="adc-button"
                disabled={editor.isBusy}
                onClick={() => void editor.unpublish()}
              >
                <EyeOff aria-hidden="true" className="adc-icon" />
                {messages.unpublish}
              </button>
            )}
            {post && status !== 'archived' && (
              <button
                type="button"
                className="adc-button adc-button--danger"
                disabled={editor.isBusy}
                onClick={() => window.confirm(messages.archiveConfirm) && void editor.archive()}
              >
                <Archive aria-hidden="true" className="adc-icon" />
                {messages.archive}
              </button>
            )}
            {editor.feedback && (
              <p
                className={editor.feedback === 'saved' ? 'adc-success' : 'adc-error'}
                role={editor.feedback === 'saved' ? 'status' : 'alert'}
              >
                {messages[editor.feedback]}
              </p>
            )}
          </Section>

          <Section title={messages.fieldCover}>
            {draft.coverImageUrl && (
              <img className="adc-cover-preview" src={draft.coverImageUrl} alt={draft.coverImageAlt} />
            )}
            {editor.canUploadCover && (
              <label className="adc-button adc-upload">
                <ImageUp aria-hidden="true" className="adc-icon" />
                {editor.isUploading ? messages.coverUploading : messages.coverUpload}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="adc-visually-hidden"
                  disabled={editor.isUploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void editor.uploadCover(file)
                  }}
                />
              </label>
            )}
            <TextField
              label={messages.fieldCoverUrl}
              type="url"
              value={draft.coverImageUrl}
              onChange={(value) => update('coverImageUrl', value)}
              error={errors.coverImageUrl ? messages.errorUrl : undefined}
            />
            <TextField
              label={messages.fieldCoverAlt}
              value={draft.coverImageAlt}
              maxLength={300}
              onChange={(value) => update('coverImageAlt', value)}
            />
            {draft.coverImageUrl && (
              <button
                type="button"
                className="adc-button adc-button--ghost"
                onClick={() => update('coverImageUrl', '')}
              >
                <Trash2 aria-hidden="true" className="adc-icon" />
                {messages.coverRemove}
              </button>
            )}
          </Section>

          <Section title={messages.fieldTags}>
            <TagsInput
              label={messages.fieldTags}
              value={draft.tags}
              suggestions={editor.tagSuggestions}
              onChange={(tags) => update('tags', tags)}
            />
            <TextField
              label={messages.fieldAuthor}
              value={draft.authorName}
              maxLength={120}
              onChange={(value) => update('authorName', value)}
            />
          </Section>

          <Section title={messages.seoSection}>
            <TextField
              label={messages.fieldSeoTitle}
              value={draft.seoTitle}
              maxLength={200}
              onChange={(value) => update('seoTitle', value)}
            />
            <TextField
              label={messages.fieldSeoDescription}
              value={draft.seoDescription}
              maxLength={320}
              multiline
              onChange={(value) => update('seoDescription', value)}
            />
            <TextField
              label={messages.fieldCanonical}
              type="url"
              value={draft.canonicalUrl}
              onChange={(value) => update('canonicalUrl', value)}
              error={errors.canonicalUrl ? messages.errorUrl : undefined}
            />
          </Section>
        </aside>
      </div>
    </form>
  )
}
