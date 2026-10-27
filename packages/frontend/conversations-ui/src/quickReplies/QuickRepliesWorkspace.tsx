import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { cn } from '../lib/cn'
import {
  useQuickRepliesWorkspace,
  insertAtCursor,
  BODY_MAX_LENGTH,
  type QuickRepliesWorkspaceApi,
} from './useQuickRepliesWorkspace'
import { canExecuteFormattingCommand } from '../lib/composer-formatting'
import {
  changedRange,
  computeFormattingEdit,
  formattingActionForShortcut,
  type QuickReplyFormattingAction,
} from './quickReplyFormatting'
import { QuickReplyFormattingToolbar } from './QuickReplyFormattingToolbar'
import { QuickReplyWhatsAppPreview } from './QuickReplyWhatsAppPreview'
import { AttachmentsFormSection } from './AttachmentsFormSection'
import { DEFAULT_QUICK_REPLIES_WORKSPACE_LABELS, type QuickRepliesWorkspaceLabels } from './labels'
import type { MaxAttachmentSizeBytes } from './quickReplyAttachments'
import type { ConversationVariable } from './quickReply.types'

const TABLE_SKELETON_ROWS = 3

/** Troca o trecho pelo navegador para o Ctrl+Z desfazer a formatação; `false` quando não dá. */
function replaceWithNativeUndo(field: HTMLTextAreaElement, previous: string, next: string): boolean {
  if (!canExecuteFormattingCommand()) return false
  const range = changedRange(previous, next)
  field.focus()
  field.setSelectionRange(range.start, range.end)
  try {
    return range.insertedText
      ? document.execCommand('insertText', false, range.insertedText)
      : document.execCommand('delete')
  } catch {
    return false
  }
}

export interface QuickRepliesWorkspaceProps {
  readonly api: QuickRepliesWorkspaceApi
  /** Catálogo de variáveis oferecido pelos botões "Inserir variável" do formulário. */
  readonly variables?: readonly ConversationVariable[]
  readonly labels?: Partial<QuickRepliesWorkspaceLabels>
  readonly className?: string
  /** Sobrescreve o teto por tipo de arquivo. Ausente, usa `DEFAULT_MAX_ATTACHMENT_SIZE_BYTES`. */
  readonly attachmentSizeLimits?: MaxAttachmentSizeBytes
}

/**
 * Tela de gestão das mensagens prontas: tabela com busca e zebra, formulário de criação/edição, e
 * exclusão com confirmação. Some o formulário quando o host não passa `createQuickReply` — vira
 * consulta, a mesma regra de capacidade do resto do pacote.
 */
export function QuickRepliesWorkspace({
  api,
  variables,
  labels,
  className,
  attachmentSizeLimits,
}: QuickRepliesWorkspaceProps) {
  const text = { ...DEFAULT_QUICK_REPLIES_WORKSPACE_LABELS, ...labels }
  const bodyFieldRef = useRef<HTMLTextAreaElement>(null)
  const formId = useId()
  const titleFieldId = `${formId}-title`
  const shortcutFieldId = `${formId}-shortcut`
  const bodyFieldId = `${formId}-body`
  /** Linha da tabela pedindo confirmação antes de excluir — em vez de `window.confirm`, que trava a
   * aba inteira e não segue os tokens visuais do pacote. */
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  /** Um botão "Excluir" por linha — para onde o foco volta quando a confirmação é cancelada. */
  const deleteButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  // A confirmação nasce sem foco nenhum: sem isto, Tab a partir de onde o operador estava levaria
  // por cima dela, e quem usa teclado nunca saberia que ela apareceu.
  useEffect(() => {
    if (confirmingDeleteId) confirmButtonRef.current?.focus()
  }, [confirmingDeleteId])

  const cancelDeleteConfirm = (id: string) => {
    setConfirmingDeleteId(null)
    deleteButtonRefs.current[id]?.focus()
  }

  const handleDeleteConfirmKeyDown = (id: string) => (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelDeleteConfirm(id)
    }
  }

  const {
    quickReplies,
    filtered,
    isLoading,
    loadError,
    search,
    setSearch,
    readOnly,
    canEdit,
    canDelete,
    editing,
    startCreate,
    startEdit,
    cancelEdit,
    updateField,
    fieldErrors,
    isSaving,
    saveError,
    submit,
    remove,
    deletingId,
    hasAttachmentsCapability,
    pendingUploads,
    addAttachmentFiles,
    retryAttachmentUpload,
    cancelAttachmentUpload,
    removeAttachment,
    moveAttachmentAt,
    attachmentRejections,
    dismissAttachmentRejections,
  } = useQuickRepliesWorkspace({ api, labels: text, ...(attachmentSizeLimits ? { attachmentSizeLimits } : {}) })

  const hasPendingUploads = pendingUploads.length > 0

  const insertVariableAtCursor = (marker: string) => {
    const field = bodyFieldRef.current
    if (!field || !editing) return
    const { text: nextBody, caret } = insertAtCursor(editing.body, field.selectionStart, field.selectionEnd, marker)
    updateField('body', nextBody)
    requestAnimationFrame(() => {
      field.focus()
      field.setSelectionRange(caret, caret)
    })
  }

  const applyFormatting = (action: QuickReplyFormattingAction) => {
    const field = bodyFieldRef.current
    if (!field || !editing) return
    const next = computeFormattingEdit({
      text: editing.body,
      selectionStart: field.selectionStart,
      selectionEnd: field.selectionEnd,
      action,
      maximumLength: BODY_MAX_LENGTH,
    })
    if (!next) return
    // O execCommand dispara o `input` nativo, e o onChange mantém o estado do React em dia.
    // Se o navegador aplicou só parte (ou nada), o estado vence o DOM.
    if (!replaceWithNativeUndo(field, editing.body, next.text) || field.value !== next.text) {
      updateField('body', next.text)
    }
    requestAnimationFrame(() => {
      field.focus()
      field.setSelectionRange(next.selectionStart, next.selectionEnd)
    })
  }

  const handleBodyKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const action = formattingActionForShortcut({
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      isComposing: event.nativeEvent.isComposing,
    })
    if (!action) return
    event.preventDefault()
    applyFormatting(action)
  }

  return (
    <div className={cn('space-y-4', className)}>
      <header className="space-y-0.5">
        <h2 className="text-lg font-semibold">{text.title}</h2>
        {/* Total cadastrado, nunca o filtrado — a busca não deve fazer parecer que sumiram
            mensagens; a contagem de resultado da busca fica em `noResults`/`empty`. */}
        <p className="text-sm text-gray-500 dark:text-gray-400">{text.subtitle(quickReplies.length)}</p>
      </header>

      {readOnly ? <p className="text-sm text-gray-500 dark:text-gray-400">{text.readOnlyNotice}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={text.searchPlaceholder}
          aria-label={text.searchPlaceholder}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 sm:w-64"
        />

        {!readOnly ? (
          <button
            type="button"
            onClick={startCreate}
            className="cv-header-action cv-header-action--primary ml-auto inline-flex items-center gap-1"
          >
            <Plus size={14} aria-hidden="true" />
            {text.create}
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <span className="sr-only" aria-live="polite">
          {text.loading}
        </span>
      ) : null}
      {loadError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {loadError || text.failure}
        </p>
      ) : null}

      {editing ? (
        <form
          className="grid gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium" htmlFor={titleFieldId}>
                {text.fieldTitle}
              </label>
              <input
                id={titleFieldId}
                type="text"
                maxLength={40}
                value={editing.title}
                onChange={(event) => updateField('title', event.target.value)}
                aria-invalid={Boolean(fieldErrors.title)}
                aria-describedby={fieldErrors.title ? `${titleFieldId}-error` : undefined}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
              {fieldErrors.title ? (
                <p id={`${titleFieldId}-error`} role="alert" className="text-xs text-red-600 dark:text-red-400">
                  {fieldErrors.title}
                </p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium" htmlFor={shortcutFieldId}>
                {text.fieldShortcut}
              </label>
              <input
                id={shortcutFieldId}
                type="text"
                maxLength={20}
                value={editing.shortcut}
                onChange={(event) => updateField('shortcut', event.target.value)}
                aria-invalid={Boolean(fieldErrors.shortcut)}
                aria-describedby={fieldErrors.shortcut ? `${shortcutFieldId}-error` : `${shortcutFieldId}-hint`}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-900"
              />
              {fieldErrors.shortcut ? (
                <p id={`${shortcutFieldId}-error`} role="alert" className="text-xs text-red-600 dark:text-red-400">
                  {fieldErrors.shortcut}
                </p>
              ) : (
                <p id={`${shortcutFieldId}-hint`} className="text-xs text-gray-400">
                  {text.fieldShortcutHint}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium" htmlFor={bodyFieldId}>
                {text.fieldBody}
              </label>
              <QuickReplyFormattingToolbar labels={text} onFormat={applyFormatting} />
              <textarea
                id={bodyFieldId}
                ref={bodyFieldRef}
                maxLength={BODY_MAX_LENGTH}
                rows={4}
                value={editing.body}
                onChange={(event) => updateField('body', event.target.value)}
                onKeyDown={handleBodyKeyDown}
                aria-invalid={Boolean(fieldErrors.body)}
                aria-describedby={fieldErrors.body ? `${bodyFieldId}-error` : undefined}
                className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
              {fieldErrors.body ? (
                <p id={`${bodyFieldId}-error`} role="alert" className="text-xs text-red-600 dark:text-red-400">
                  {fieldErrors.body}
                </p>
              ) : null}
              {variables && variables.length > 0 ? (
                <div className="flex flex-wrap gap-1 pt-1">
                  {variables.map((variable) => (
                    <button
                      key={variable.id}
                      type="button"
                      onClick={() => insertVariableAtCursor(variable.marker)}
                      aria-label={`${text.insertVariable}: ${variable.label}`}
                      className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      {variable.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {hasAttachmentsCapability ? (
              <AttachmentsFormSection
                labels={text}
                attachments={editing.attachments}
                pendingUploads={pendingUploads}
                attachmentRejections={attachmentRejections}
                onAddFiles={addAttachmentFiles}
                onRetryUpload={retryAttachmentUpload}
                onCancelUpload={cancelAttachmentUpload}
                onRemoveAttachment={removeAttachment}
                onMoveAttachment={moveAttachmentAt}
                onDismissRejections={dismissAttachmentRejections}
              />
            ) : null}

            {saveError ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {saveError}
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isSaving || hasPendingUploads}
                aria-busy={isSaving}
                title={hasPendingUploads ? text.saveBlockedUploading : undefined}
                className="cv-header-action inline-flex items-center gap-1 disabled:opacity-40"
              >
                {isSaving ? text.saving : hasPendingUploads ? text.saveBlockedUploading : text.save}
              </button>
              <button type="button" onClick={cancelEdit} className="text-sm text-gray-500 hover:underline">
                {text.cancel}
              </button>
            </div>
          </div>

          <QuickReplyWhatsAppPreview
            body={editing.body}
            {...(variables ? { variables } : {})}
            attachments={editing.attachments}
            labels={text}
          />
        </form>
      ) : null}

      <div className="cv-table-card">
        <table className="cv-table">
          <thead>
            <tr>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium">
                {text.columnTitle}
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium">
                {text.columnShortcut}
              </th>
              <th scope="col" className="hidden px-3 py-2 text-left text-xs font-medium sm:table-cell">
                {text.columnBody}
              </th>
              {!readOnly ? (
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium">
                  {text.columnActions}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: TABLE_SKELETON_ROWS }).map((_, index) => (
                <tr key={index} aria-hidden="true">
                  <td className="px-3 py-3">
                    <span className="cv-skeleton-line cv-skeleton-line--title block" />
                  </td>
                  <td className="px-3 py-3">
                    <span className="cv-skeleton-line cv-skeleton-line--shortcut block" />
                  </td>
                  <td className="hidden px-3 py-3 sm:table-cell">
                    <span className="cv-skeleton-line cv-skeleton-line--body block" />
                  </td>
                  {!readOnly ? <td className="px-3 py-3" /> : null}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  {search.trim() ? text.noResults : text.empty}
                </td>
              </tr>
            ) : null}
            {!isLoading &&
              filtered.map((quickReply) => (
                <tr key={quickReply.id} className={cn(deletingId === quickReply.id ? 'cv-row-departing' : undefined)}>
                  <td className="px-3 py-2 font-medium">{quickReply.title}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">/{quickReply.shortcut}</td>
                  <td className="hidden max-w-sm truncate px-3 py-2 text-gray-500 sm:table-cell">{quickReply.body}</td>
                  {!readOnly ? (
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => startEdit(quickReply)}
                            data-cv-tooltip={text.edit}
                            aria-label={`${text.edit}: ${quickReply.title}`}
                            className="cv-header-icon"
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                        ) : null}
                        {canDelete ? (
                          confirmingDeleteId === quickReply.id ? (
                            // Linha de confirmação inline em vez de `window.confirm`: trava a aba
                            // inteira e não segue os tokens visuais do pacote (`web.md` §14).
                            <span
                              role="group"
                              aria-label={text.removeConfirm(quickReply.title)}
                              onKeyDown={handleDeleteConfirmKeyDown(quickReply.id)}
                              className="flex items-center gap-2 text-xs"
                            >
                              {text.removeConfirm(quickReply.title)}
                              <button
                                ref={confirmButtonRef}
                                type="button"
                                onClick={() => {
                                  setConfirmingDeleteId(null)
                                  void remove(quickReply.id)
                                }}
                                className="cv-header-action cv-header-action--danger inline-flex items-center gap-1"
                              >
                                <Trash2 size={12} aria-hidden="true" />
                                {text.remove}
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelDeleteConfirm(quickReply.id)}
                                className="cv-header-action"
                              >
                                {text.cancel}
                              </button>
                            </span>
                          ) : (
                            <button
                              ref={(node) => {
                                deleteButtonRefs.current[quickReply.id] = node
                              }}
                              type="button"
                              disabled={deletingId === quickReply.id}
                              aria-busy={deletingId === quickReply.id}
                              onClick={() => setConfirmingDeleteId(quickReply.id)}
                              data-cv-tooltip={deletingId === quickReply.id ? text.deleting : text.remove}
                              aria-label={`${deletingId === quickReply.id ? text.deleting : text.remove}: ${quickReply.title}`}
                              className="cv-header-icon disabled:opacity-40"
                            >
                              <Trash2 size={14} aria-hidden="true" className="text-red-500" />
                            </button>
                          )
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
