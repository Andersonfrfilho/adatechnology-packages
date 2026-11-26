/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Campo do corpo: barra de formatação + textarea. Guarda Markdown puro; a barra só escreve a
 * sintaxe sobre a seleção. Atalhos: Ctrl/Cmd+B negrito, I itálico, K link.
 */

import {
  Bold,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Smile,
  type LucideIcon,
} from 'lucide-react'
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'

import type { UploadImageResult } from '../hooks/usePostEditor'
import {
  insertImage,
  insertLink,
  insertText,
  toggleLinePrefix,
  toggleWrap,
  type LinePrefixKind,
  type TextSelection,
} from '../lib/markdownFormat'
import type { ContentMessages } from '../locales'
import { useContentText } from '../providers/ContentProvider'
import { EmojiPicker } from './EmojiPicker'
import { InsertDialog } from './InsertDialog'
import { Tooltip } from './Tooltip'

export type MarkdownEditorProps = {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly labelledBy: string
  readonly describedBy?: string
  readonly showToolbar?: boolean
  /** Ausente: o botão de imagem só aceita URL, sem envio de arquivo. */
  readonly onUploadImage?: (file: File) => Promise<UploadImageResult>
  readonly isUploading?: boolean
}

type Panel = 'link' | 'image' | 'emoji'
type SimpleAction = {
  readonly id: string
  readonly icon: LucideIcon
  readonly label: keyof ContentMessages
  readonly shortcut?: string
}

const SIMPLE_ACTIONS: readonly SimpleAction[] = [
  { id: 'bold', icon: Bold, label: 'formatBold', shortcut: 'B' },
  { id: 'italic', icon: Italic, label: 'formatItalic', shortcut: 'I' },
  { id: 'heading2', icon: Heading2, label: 'formatHeading2' },
  { id: 'heading3', icon: Heading3, label: 'formatHeading3' },
  { id: 'bulletList', icon: List, label: 'formatBulletList' },
  { id: 'numberedList', icon: ListOrdered, label: 'formatNumberedList' },
  { id: 'quote', icon: Quote, label: 'formatQuote' },
]

type ToolButtonProps = {
  readonly icon: LucideIcon
  readonly text: string
  readonly isExpanded?: boolean
  readonly onClick: () => void
}

function ToolButton({ icon: Icon, text, isExpanded, onClick }: ToolButtonProps) {
  return (
    <Tooltip text={text}>
      <button
        type="button"
        className="adc-tool"
        aria-label={text}
        {...(isExpanded === undefined ? {} : { 'aria-expanded': isExpanded })}
        onClick={onClick}
      >
        <Icon aria-hidden="true" className="adc-icon" />
      </button>
    </Tooltip>
  )
}

export function MarkdownEditor({
  value,
  onChange,
  labelledBy,
  describedBy,
  showToolbar = true,
  onUploadImage,
  isUploading = false,
}: MarkdownEditorProps) {
  const { messages } = useContentText()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelection = useRef<{ start: number; end: number } | undefined>(undefined)
  const savedSelection = useRef<TextSelection>({ value, start: value.length, end: value.length })
  const [panel, setPanel] = useState<Panel | undefined>()

  useLayoutEffect(() => {
    const pending = pendingSelection.current
    const textarea = textareaRef.current
    if (!pending || !textarea) return
    pendingSelection.current = undefined
    textarea.focus()
    textarea.setSelectionRange(pending.start, pending.end)
  }, [value])

  function readSelection(): TextSelection {
    const textarea = textareaRef.current
    return { value, start: textarea?.selectionStart ?? value.length, end: textarea?.selectionEnd ?? value.length }
  }

  function apply(next: TextSelection): void {
    pendingSelection.current = { start: next.start, end: next.end }
    onChange(next.value)
    setPanel(undefined)
  }

  function run(id: string): void {
    const selection = readSelection()
    const sample = messages.formatSampleText
    if (id === 'bold') return apply(toggleWrap(selection, '**', sample))
    if (id === 'italic') return apply(toggleWrap(selection, '*', sample))
    apply(toggleLinePrefix(selection, id as LinePrefixKind, sample))
  }

  function openPanel(next: Panel): void {
    if (panel === next) return setPanel(undefined)
    savedSelection.current = readSelection()
    setPanel(next)
  }

  function closePanel(): void {
    setPanel(undefined)
    textareaRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (!showToolbar || !(event.ctrlKey || event.metaKey) || event.altKey) return
    const key = event.key.toLowerCase()
    if (key !== 'b' && key !== 'i' && key !== 'k') return
    event.preventDefault()
    if (key === 'k') return openPanel('link')
    run(key === 'b' ? 'bold' : 'italic')
  }

  const saved = savedSelection.current
  const selectedText = saved.value.slice(saved.start, saved.end)

  return (
    <div className="adc-md-editor">
      {showToolbar && (
        <div className="adc-md-toolbar" role="toolbar" aria-label={messages.toolbarLabel}>
          {SIMPLE_ACTIONS.map(({ id, icon, label, shortcut }) => (
            <ToolButton
              key={id}
              icon={icon}
              text={shortcut ? `${messages[label]} (Ctrl+${shortcut})` : messages[label]}
              onClick={() => run(id)}
            />
          ))}
          <ToolButton
            icon={LinkIcon}
            text={`${messages.formatLink} (Ctrl+K)`}
            isExpanded={panel === 'link'}
            onClick={() => openPanel('link')}
          />
          <ToolButton
            icon={ImageIcon}
            text={messages.formatImage}
            isExpanded={panel === 'image'}
            onClick={() => openPanel('image')}
          />
          <ToolButton
            icon={Smile}
            text={messages.formatEmoji}
            isExpanded={panel === 'emoji'}
            onClick={() => openPanel('emoji')}
          />
        </div>
      )}
      {panel === 'link' && (
        <InsertDialog
          kind="link"
          initialText={selectedText}
          onClose={closePanel}
          onSubmit={(values) => apply(insertLink(saved, values))}
        />
      )}
      {panel === 'image' && (
        <InsertDialog
          kind="image"
          initialText=""
          isUploading={isUploading}
          {...(onUploadImage ? { onUpload: onUploadImage } : {})}
          onClose={closePanel}
          onSubmit={(values) => apply(insertImage(saved, values))}
        />
      )}
      {panel === 'emoji' && <EmojiPicker onClose={closePanel} onPick={(emoji) => apply(insertText(saved, emoji))} />}
      <textarea
        ref={textareaRef}
        aria-labelledby={labelledBy}
        {...(describedBy ? { 'aria-describedby': describedBy } : {})}
        className="adc-markdown-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}
