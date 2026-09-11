import { useRef } from 'react'
import { cn } from '../lib/cn'
import { useQuickRepliesWorkspace, insertAtCursor, type QuickRepliesWorkspaceApi } from './useQuickRepliesWorkspace'
import { DEFAULT_QUICK_REPLIES_WORKSPACE_LABELS, type QuickRepliesWorkspaceLabels } from './labels'
import type { ConversationVariable } from './quickReply.types'

export interface QuickRepliesWorkspaceProps {
  readonly api: QuickRepliesWorkspaceApi
  /** Catálogo de variáveis oferecido pelos botões "Inserir variável" do formulário. */
  readonly variables?: readonly ConversationVariable[]
  readonly labels?: Partial<QuickRepliesWorkspaceLabels>
  readonly className?: string
}

/**
 * Tela de gestão das mensagens prontas: tabela com busca e zebra, formulário de criação/edição, e
 * exclusão com confirmação. Some o formulário quando o host não passa `createQuickReply` — vira
 * consulta, a mesma regra de capacidade do resto do pacote.
 */
export function QuickRepliesWorkspace({ api, variables, labels, className }: QuickRepliesWorkspaceProps) {
  const text = { ...DEFAULT_QUICK_REPLIES_WORKSPACE_LABELS, ...labels }
  const bodyFieldRef = useRef<HTMLTextAreaElement>(null)

  const {
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
  } = useQuickRepliesWorkspace({ api, labels: text })

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

  return (
    <div className={cn('space-y-4', className)}>
      <header className="space-y-0.5">
        <h2 className="text-lg font-semibold">{text.title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{text.subtitle(filtered.length)}</p>
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
            className="cv-header-action ml-auto inline-flex items-center gap-1"
          >
            {text.create}
          </button>
        ) : null}
      </div>

      {isLoading ? <p className="text-sm text-gray-500 dark:text-gray-400">{text.loading}</p> : null}
      {loadError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {loadError || text.failure}
        </p>
      ) : null}

      {editing ? (
        <form
          className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <div className="space-y-1">
            <label className="block text-sm font-medium" htmlFor="quick-reply-title">
              {text.fieldTitle}
            </label>
            <input
              id="quick-reply-title"
              type="text"
              maxLength={40}
              value={editing.title}
              onChange={(event) => updateField('title', event.target.value)}
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby={fieldErrors.title ? 'quick-reply-title-error' : undefined}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            {fieldErrors.title ? (
              <p id="quick-reply-title-error" role="alert" className="text-xs text-red-600 dark:text-red-400">
                {fieldErrors.title}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium" htmlFor="quick-reply-shortcut">
              {text.fieldShortcut}
            </label>
            <input
              id="quick-reply-shortcut"
              type="text"
              maxLength={20}
              value={editing.shortcut}
              onChange={(event) => updateField('shortcut', event.target.value)}
              aria-invalid={Boolean(fieldErrors.shortcut)}
              aria-describedby={fieldErrors.shortcut ? 'quick-reply-shortcut-error' : 'quick-reply-shortcut-hint'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-900"
            />
            {fieldErrors.shortcut ? (
              <p id="quick-reply-shortcut-error" role="alert" className="text-xs text-red-600 dark:text-red-400">
                {fieldErrors.shortcut}
              </p>
            ) : (
              <p id="quick-reply-shortcut-hint" className="text-xs text-gray-400">
                {text.fieldShortcutHint}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium" htmlFor="quick-reply-body">
              {text.fieldBody}
            </label>
            <textarea
              id="quick-reply-body"
              ref={bodyFieldRef}
              maxLength={1000}
              rows={4}
              value={editing.body}
              onChange={(event) => updateField('body', event.target.value)}
              aria-invalid={Boolean(fieldErrors.body)}
              aria-describedby={fieldErrors.body ? 'quick-reply-body-error' : undefined}
              className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            {fieldErrors.body ? (
              <p id="quick-reply-body-error" role="alert" className="text-xs text-red-600 dark:text-red-400">
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

          {saveError ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {saveError}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="cv-header-action inline-flex items-center gap-1 disabled:opacity-40"
            >
              {text.save}
            </button>
            <button type="button" onClick={cancelEdit} className="text-sm text-gray-500 hover:underline">
              {text.cancel}
            </button>
          </div>
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
            {filtered.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  {search.trim() ? text.noResults : text.empty}
                </td>
              </tr>
            ) : null}
            {filtered.map((quickReply) => (
              <tr key={quickReply.id}>
                <td className="px-3 py-2 font-medium">{quickReply.title}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">/{quickReply.shortcut}</td>
                <td className="hidden max-w-sm truncate px-3 py-2 text-gray-500 sm:table-cell">{quickReply.body}</td>
                {!readOnly ? (
                  <td className="flex gap-2 px-3 py-2">
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => startEdit(quickReply)}
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {text.edit}
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(text.removeConfirm(quickReply.title))) void remove(quickReply.id)
                        }}
                        className="text-xs text-red-600 hover:underline dark:text-red-400"
                      >
                        {text.remove}
                      </button>
                    ) : null}
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
