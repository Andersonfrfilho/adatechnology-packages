import { useRef, type ReactNode } from 'react'
import { Bold, Italic, Strikethrough } from 'lucide-react'

export interface WhatsAppMessageEditorLabels {
  bold: string
  /** Tooltip da negrito — traz a sintaxe do WhatsApp junto, por isso é separado do `aria-label`. */
  boldHint: string
  italic: string
  italicHint: string
  strikethrough: string
  strikethroughHint: string
  insertPlaceholder: (token: string) => string
}

export const DEFAULT_WHATSAPP_MESSAGE_EDITOR_LABELS: WhatsAppMessageEditorLabels = {
  bold: 'Negrito',
  boldHint: 'Negrito (*texto*)',
  italic: 'Itálico',
  italicHint: 'Itálico (_texto_)',
  strikethrough: 'Tachado',
  strikethroughHint: 'Tachado (~texto~)',
  insertPlaceholder: (token: string) => `Inserir ${token}`,
}

export interface WhatsAppMessageEditorProps {
  labels?: Partial<WhatsAppMessageEditorLabels>
  value: string
  onChange: (value: string) => void
  placeholder?: string
  placeholders?: readonly string[]
  rows?: number
  previewLabel?: string
  emptyPreviewText?: string
}

const INLINE_TOKEN = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`|\{[a-zA-Z_]+\})/g

function renderLine(line: string, lineKey: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let tokenIndex = 0
  INLINE_TOKEN.lastIndex = 0
  while ((match = INLINE_TOKEN.exec(line)) !== null) {
    if (match.index > lastIndex) nodes.push(line.slice(lastIndex, match.index))
    const token = match[0]
    const key = `${lineKey}-${tokenIndex++}`
    if (token.startsWith('*')) nodes.push(<strong key={key}>{token.slice(1, -1)}</strong>)
    else if (token.startsWith('_')) nodes.push(<em key={key}>{token.slice(1, -1)}</em>)
    else if (token.startsWith('~')) nodes.push(<s key={key}>{token.slice(1, -1)}</s>)
    else if (token.startsWith('`')) nodes.push(<code key={key} className="font-mono text-[0.85em]">{token.slice(1, -1)}</code>)
    else nodes.push(<span key={key} className="rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1">{token}</span>)
    lastIndex = INLINE_TOKEN.lastIndex
  }
  if (lastIndex < line.length) nodes.push(line.slice(lastIndex))
  return nodes
}

function renderWhatsApp(text: string): ReactNode[] {
  const lines = text.split('\n')
  return lines.map((line, index) => (
    <span key={`ln-${index}`}>
      {renderLine(line, `ln-${index}`)}
      {index < lines.length - 1 ? <br /> : null}
    </span>
  ))
}

// Paridade com financiamento-imobiliario-bot/apps/web/src/components/WhatsAppMessageEditor.tsx —
// editor para autoria de templates/mensagens padrão (welcome, farewell, etc.), com toolbar de
// formatação, inserção de placeholders de variável e preview no estilo balão do WhatsApp.
// Diferente de MessageComposer (caixa de envio de uma conversa ao vivo).
export function WhatsAppMessageEditor({
  value,
  onChange,
  placeholder,
  placeholders = [],
  rows = 4,
  previewLabel = 'Prévia (como aparece no WhatsApp)',
  emptyPreviewText = 'Sua mensagem aparecerá aqui…',
  labels,
}: WhatsAppMessageEditorProps) {
  const editorLabels = { ...DEFAULT_WHATSAPP_MESSAGE_EDITOR_LABELS, ...labels }
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function wrapSelection(marker: string): void {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = value.slice(start, end) || 'texto'
    const next = value.slice(0, start) + marker + selected + marker + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + marker.length, start + marker.length + selected.length)
    })
  }

  function insertAtCursor(snippet: string): void {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const next = value.slice(0, start) + snippet + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      textarea.focus()
      const caret = start + snippet.length
      textarea.setSelectionRange(caret, caret)
    })
  }

  const toolbarButtonClass =
    'inline-flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <button type="button" onClick={() => wrapSelection('*')} className={toolbarButtonClass} title={editorLabels.boldHint} aria-label={editorLabels.bold}>
          <Bold size={15} />
        </button>
        <button type="button" onClick={() => wrapSelection('_')} className={toolbarButtonClass} title={editorLabels.italicHint} aria-label={editorLabels.italic}>
          <Italic size={15} />
        </button>
        <button type="button" onClick={() => wrapSelection('~')} className={toolbarButtonClass} title={editorLabels.strikethroughHint} aria-label={editorLabels.strikethrough}>
          <Strikethrough size={15} />
        </button>
        {placeholders.length > 0 && (
          <>
            <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-600" />
            {placeholders.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => insertAtCursor(token)}
                className="inline-flex items-center h-8 px-2 rounded-lg border border-gray-200 dark:border-gray-600 text-xs text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors"
                title={editorLabels.insertPlaceholder(token)}
              >
                {token}
              </button>
            ))}
          </>
        )}
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-y"
      />

      <div className="mt-2">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{previewLabel}</p>
        <div className="rounded-xl bg-[#e5ded8] dark:bg-gray-900 p-3">
          <div className="inline-block max-w-full rounded-lg rounded-tl-none bg-white dark:bg-gray-800 shadow-sm px-3 py-2 text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words">
            {value.trim() ? renderWhatsApp(value) : <span className="text-gray-400 dark:text-gray-500">{emptyPreviewText}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
