/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Editor das mensagens que o host declarou (`templateDefinitions` no módulo): lista agrupada na
 * ordem declarada, texto com variáveis inseríveis, preview com os exemplos declarados, salvar
 * (versão nova) e restaurar o padrão. Nada de HTML bruto: o preview entra como nós React.
 */

import { useRef, useState } from 'react'
import clsx from 'clsx'
import { parseWhatsAppFormatting } from '@adatechnology/conversations-ui'
import type {
  NotificationChannel,
  NotificationTemplate,
  TemplateEditorItem,
} from '@adatechnology/notification-contracts'

import { useNotificationContext } from '../NotificationProvider'
import { useRestoreTemplateDefault, useTemplateDefinitions, useUpsertTemplate } from '../hooks/usePreferences'
import {
  groupTemplateEditorItems,
  insertVariable,
  isDraftDirty,
  renderDefinitionPreview,
  resolveEditorBody,
  templateEditorItemId,
} from '../templateDefinitions.util'

export type TemplateDefinitionsEditorProps = {
  readonly className?: string
  /** Mostra só estes canais. Ausente, todos os declarados. */
  readonly channels?: readonly NotificationChannel[]
  readonly onSaved?: (template: NotificationTemplate) => void
  readonly onRestored?: (template: NotificationTemplate) => void
}

type Feedback = 'saved' | 'restored' | 'error' | undefined

export function TemplateDefinitionsEditor({
  className,
  channels,
  onSaved,
  onRestored,
}: TemplateDefinitionsEditorProps) {
  const { messages, theme } = useNotificationContext()
  const definitions = useTemplateDefinitions()
  const upsert = useUpsertTemplate()
  const restore = useRestoreTemplateDefault()

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({})
  const [feedback, setFeedback] = useState<Feedback>(undefined)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const items = (definitions.data ?? []).filter((item) => !channels || channels.includes(item.channel))
  const selected = items.find((item) => templateEditorItemId(item) === selectedId)

  function clearDraft(id: string): void {
    setDrafts(({ [id]: _removed, ...rest }) => rest)
  }

  function handleSelect(item: TemplateEditorItem): void {
    setSelectedId(templateEditorItemId(item))
    setFeedback(undefined)
  }

  function handleChange(id: string, body: string): void {
    setDrafts((current) => ({ ...current, [id]: body }))
    setFeedback(undefined)
  }

  function handleInsertVariable(item: TemplateEditorItem, variableName: string): void {
    const id = templateEditorItemId(item)
    const field = textareaRef.current
    const body = resolveEditorBody(item, drafts[id])
    const { text, cursor } = insertVariable({
      body,
      variableName,
      selectionStart: field?.selectionStart ?? body.length,
      selectionEnd: field?.selectionEnd ?? body.length,
    })
    handleChange(id, text)
    requestAnimationFrame(() => {
      field?.focus()
      field?.setSelectionRange(cursor, cursor)
    })
  }

  function handleSave(item: TemplateEditorItem): void {
    const id = templateEditorItemId(item)
    upsert.mutate(
      {
        key: item.key,
        channel: item.channel,
        locale: item.locale,
        body: resolveEditorBody(item, drafts[id]),
        ...((item.current?.subject ?? item.defaultSubject)
          ? { subject: item.current?.subject ?? item.defaultSubject }
          : {}),
        ...(item.current?.whatsappTemplateName ? { whatsappTemplateName: item.current.whatsappTemplateName } : {}),
        active: true,
      },
      {
        onSuccess(template) {
          clearDraft(id)
          setFeedback('saved')
          onSaved?.(template)
        },
        onError: () => setFeedback('error'),
      },
    )
  }

  function handleRestore(item: TemplateEditorItem): void {
    if (!item.current) return
    restore.mutate(item.current.id, {
      onSuccess(template) {
        clearDraft(templateEditorItemId(item))
        setFeedback('restored')
        onRestored?.(template)
      },
      onError: () => setFeedback('error'),
    })
  }

  const rootClassName = clsx('adn-definitions', theme.rootClassName, className)

  if (definitions.isPending)
    return <p className={clsx(rootClassName, 'adn-definitions__state')}>{messages['definitions.loading']}</p>
  if (definitions.isError) {
    return (
      <div className={rootClassName} role="alert">
        <p className="adn-definitions__state">{messages['definitions.error']}</p>
        <button type="button" className="adn-definitions__button" onClick={() => void definitions.refetch()}>
          {messages['definitions.retry']}
        </button>
      </div>
    )
  }
  if (items.length === 0)
    return <p className={clsx(rootClassName, 'adn-definitions__state')}>{messages['definitions.empty']}</p>

  const isBusy = upsert.isPending || restore.isPending

  return (
    <section className={rootClassName} aria-label={messages['definitions.title']}>
      <nav className="adn-definitions__list" aria-label={messages['definitions.listLabel']}>
        <h2 className="adn-definitions__title">{messages['definitions.title']}</h2>
        {groupTemplateEditorItems(items).map((group) => (
          <div key={group.category} role="group" aria-label={group.category} className="adn-definitions__group">
            <h3 className="adn-definitions__group-title">{group.category}</h3>
            <ul className="adn-definitions__items">
              {group.items.map((item) => {
                const id = templateEditorItemId(item)
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className="adn-definitions__item"
                      aria-current={id === selectedId ? 'true' : undefined}
                      onClick={() => handleSelect(item)}
                    >
                      <span>{item.label}</span>
                      {item.isCustomized ? (
                        <span className="adn-definitions__badge">{messages['definitions.edited']}</span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {selected ? (
        <DefinitionForm
          item={selected}
          draftBody={drafts[templateEditorItemId(selected)]}
          isBusy={isBusy}
          isSaving={upsert.isPending}
          isRestoring={restore.isPending}
          feedback={feedback}
          textareaRef={textareaRef}
          onChange={(body) => handleChange(templateEditorItemId(selected), body)}
          onInsertVariable={(name) => handleInsertVariable(selected, name)}
          onSave={() => handleSave(selected)}
          onRestore={() => handleRestore(selected)}
        />
      ) : (
        <p className="adn-definitions__state">{messages['definitions.pick']}</p>
      )}
    </section>
  )
}

type DefinitionFormProps = {
  readonly item: TemplateEditorItem
  readonly draftBody: string | undefined
  readonly isBusy: boolean
  readonly isSaving: boolean
  readonly isRestoring: boolean
  readonly feedback: Feedback
  readonly textareaRef: React.RefObject<HTMLTextAreaElement | null>
  readonly onChange: (body: string) => void
  readonly onInsertVariable: (name: string) => void
  readonly onSave: () => void
  readonly onRestore: () => void
}

function DefinitionForm(props: DefinitionFormProps) {
  const { item, draftBody, isBusy, isSaving, isRestoring, feedback, textareaRef } = props
  const { messages } = useNotificationContext()
  const body = resolveEditorBody(item, draftBody)
  const rendered = renderDefinitionPreview(item, body)
  const fieldId = `adn-definition-body-${templateEditorItemId(item)}`
  const canRestore = item.current !== undefined && (item.isCustomized || isDraftDirty(item, draftBody))
  const feedbackMessage = {
    saved: messages['definitions.saved'],
    restored: messages['definitions.restored'],
    error: messages['definitions.actionError'],
  }

  return (
    <div className="adn-definitions__form">
      <header>
        <h3 className="adn-definitions__label">
          {item.label}
          {item.isCustomized ? <span className="adn-definitions__badge">{messages['definitions.edited']}</span> : null}
        </h3>
        {item.description ? <p className="adn-definitions__description">{item.description}</p> : null}
        <p className="adn-definitions__meta">
          {item.channel} · {item.locale} ·{' '}
          {item.current
            ? `${messages['definitions.version']} ${item.current.version}`
            : messages['definitions.notSaved']}
        </p>
      </header>

      <label htmlFor={fieldId} className="adn-definitions__field-label">
        {messages['definitions.bodyLabel']}
      </label>
      <textarea
        id={fieldId}
        ref={textareaRef}
        className="adn-definitions__textarea"
        rows={6}
        value={body}
        onChange={(event) => props.onChange(event.target.value)}
      />

      {item.variables.length > 0 ? (
        <div role="group" aria-label={messages['definitions.variables']}>
          <p className="adn-definitions__field-label">{messages['definitions.variables']}</p>
          <ul className="adn-definitions__chips">
            {item.variables.map((variable) => (
              <li key={variable.name}>
                <button
                  type="button"
                  className="adn-definitions__chip"
                  title={[variable.description, `${messages['definitions.variableExample']}: ${variable.example}`]
                    .filter(Boolean)
                    .join(' — ')}
                  onClick={() => props.onInsertVariable(variable.name)}
                >
                  {`{{${variable.name}}}`}
                  {variable.required ? <span className="adn-definitions__required"> *</span> : null}
                </button>
                {variable.description ? <span className="adn-definitions__hint">{variable.description}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="adn-definitions__field-label">{messages['definitions.preview']}</p>
        <div className="adn-definitions__preview" data-channel={item.channel}>
          {item.channel === 'whatsapp' ? parseWhatsAppFormatting(rendered.body) : rendered.body}
        </div>
      </div>

      <div className="adn-definitions__actions">
        <button
          type="button"
          className="adn-definitions__button"
          disabled={isBusy || body.trim() === ''}
          onClick={props.onSave}
        >
          {isSaving ? messages['definitions.saving'] : messages['definitions.save']}
        </button>
        <button
          type="button"
          className="adn-definitions__button adn-definitions__button--secondary"
          disabled={isBusy || !canRestore}
          onClick={props.onRestore}
        >
          {isRestoring ? messages['definitions.restoring'] : messages['definitions.restore']}
        </button>
        <span className="adn-definitions__feedback" role="status" aria-live="polite">
          {feedback ? feedbackMessage[feedback] : ''}
        </span>
      </div>
    </div>
  )
}
