import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useId,
  type KeyboardEvent,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { AudioRecorderButton } from './AudioRecorderButton'
import type { ConversationsFeatures } from './types'
import { cn } from './lib/cn'
import { COMPOSER_BAR_CLASS, QUICK_REPLY_PILL_CLASS } from './composer.constant'
import { EmojiPicker } from './EmojiPicker'
import { QuickRepliesPicker } from './quickReplies/QuickRepliesPicker'
import { useQuickRepliesPicker } from './quickReplies/useQuickRepliesPicker'
import { detectQuickReplyShortcut, replaceQuickReplyShortcut } from './quickReplies/quickReplyShortcut'
import type { QuickReply as SavedQuickReply } from './quickReplies/quickReply.types'
import type { QuickRepliesPickerLabels } from './quickReplies/labels'

/**
 * Mensagem pronta que o atendente cola no campo com um clique.
 *
 * `text` aceita string com `{{variavel}}` ou função: a string cobre o caso comum (copy fixa com o
 * nome do cliente no meio) sem o host escrever código, e a função cobre o que precisa de lógica —
 * escolher texto por produto, pluralizar, formatar moeda.
 */
export interface QuickReply {
  key: string
  /** O que aparece no chip, emoji incluso: `👋 Saudação`. */
  label: string
  text: string | ((variables: Readonly<Record<string, string>>) => string)
}

/**
 * Troca `{{nome}}` pelos valores passados. Variável ausente vira string vazia, e não o literal
 * `{{nome}}`: mandar "Olá {{nome}}!" para o cliente é pior que mandar "Olá !".
 */
export function applyQuickReplyVariables(template: string, variables: Readonly<Record<string, string>> = {}): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, chave: string) => variables[chave] ?? '')
}

export function resolveQuickReply(quickReply: QuickReply, variables: Readonly<Record<string, string>> = {}): string {
  return typeof quickReply.text === 'function'
    ? quickReply.text(variables)
    : applyQuickReplyVariables(quickReply.text, variables)
}

export interface MessageComposerLabels {
  emoji: string
  attach: string
  send: string
  removeAttachment: string
  quickReplies: string
}

export const DEFAULT_MESSAGE_COMPOSER_LABELS: MessageComposerLabels = {
  emoji: 'Emoji',
  attach: 'Anexar',
  send: 'Enviar',
  removeAttachment: 'Remover anexo',
  quickReplies: 'Mensagens prontas',
}

/**
 * Mensagens prontas do produto, cadastradas pela tela de gestão. **Opcional por capacidade:** sem
 * esta prop o botão de raio e o atalho `/` simplesmente não existem — não um botão que abre uma
 * lista vazia.
 */
export interface MessageComposerSavedQuickReplies {
  readonly listQuickReplies: (params?: { search?: string }) => Promise<SavedQuickReply[]>
  /** Chave do cache do picker — troca de conversa não deve reconsultar o que já carregou. */
  readonly conversationId: string
  readonly variables?: Readonly<Record<string, string>>
  readonly labels?: Partial<QuickRepliesPickerLabels>
  /**
   * Avisada antes de inserir o texto, para o host empurrar os anexos da mensagem escolhida na fila
   * do composer (QR-32). Sem esta prop nada muda — o texto continua sendo inserido do mesmo jeito.
   */
  readonly onSelect?: (quickReply: SavedQuickReply) => void
  /** Sem `sendStoredAttachments` no host, a linha com anexo avisa em vez de prometer envio (QR-33). */
  readonly hasAttachmentsCapability?: boolean
}

export interface MessageComposerProps {
  labels?: Partial<MessageComposerLabels>
  onSend: (text: string) => void
  onAttach?: (file: File) => void
  value?: string
  onChange?: (value: string) => void
  features?: ConversationsFeatures
  placeholder?: string
  maxLength?: number
  disabled?: boolean
  acceptedFileTypes?: string
  /**
   * Ocupa o lugar do botão de enviar enquanto não há nada para enviar — é onde o WhatsApp põe o
   * microfone. Fora do campo, o botão vira um bloco solto ao lado do pill e quebra a barra.
   */
  idleAction?: ReactNode
  /** Mensagens prontas exibidas acima do campo. Vazio ou ausente, a faixa não é renderizada. */
  quickReplies?: readonly QuickReply[]
  /** Valores para `{{variavel}}` — tipicamente nome do cliente, produto, protocolo. */
  quickReplyVariables?: Readonly<Record<string, string>>
  /** Botão de raio + atalho `/` para as mensagens prontas cadastradas. Ausente, nenhum dos dois aparece. */
  savedQuickReplies?: MessageComposerSavedQuickReplies
  className?: string
  classNames?: Partial<MessageComposerClassNames>
}

export interface MessageComposerClassNames {
  root: string
  quickReplies: string
  quickReply: string
  field: string
}

/**
 * Exatamente o que a Meta aceita em mensagem de mídia — imagem, sticker, áudio, vídeo e a lista
 * fechada de documentos. Oferecer no seletor um formato que o WhatsApp recusa (`.zip`, `.rtf`)
 * empurra a falha para depois do envio, quando já não dá para explicar ao operador o que houve.
 * Produto com regra própria passa `acceptedFileTypes`.
 */
export const DEFAULT_ACCEPTED_FILE_TYPES = [
  'image/jpeg,image/png,image/webp',
  'audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg',
  'video/mp4,video/3gpp',
  'application/pdf,text/plain,text/csv',
  'application/msword,application/vnd.ms-excel,application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
].join(',')

interface FilePreview {
  file: File
  previewUrl: string
}

export const MessageComposer = ({
  onSend,
  onAttach,
  value: externalValue,
  onChange: externalOnChange,
  quickReplies,
  quickReplyVariables,
  savedQuickReplies,
  features,
  placeholder = 'Digite uma mensagem...',
  maxLength,
  disabled = false,
  acceptedFileTypes = DEFAULT_ACCEPTED_FILE_TYPES,
  idleAction,
  className,
  classNames,
  labels,
}: MessageComposerProps) => {
  const emojiLabel = labels?.emoji ?? DEFAULT_MESSAGE_COMPOSER_LABELS.emoji
  const attachLabel = labels?.attach ?? DEFAULT_MESSAGE_COMPOSER_LABELS.attach
  const sendLabel = labels?.send ?? DEFAULT_MESSAGE_COMPOSER_LABELS.send
  const removeAttachmentLabel = labels?.removeAttachment ?? DEFAULT_MESSAGE_COMPOSER_LABELS.removeAttachment
  const quickRepliesLabel = labels?.quickReplies ?? DEFAULT_MESSAGE_COMPOSER_LABELS.quickReplies
  const [internalText, setInternalText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [attachments, setAttachments] = useState<FilePreview[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const quickRepliesListboxId = useId()
  const [isQuickRepliesOpen, setIsQuickRepliesOpen] = useState(false)
  const [quickRepliesTerm, setQuickRepliesTerm] = useState('')
  const [shortcutStart, setShortcutStart] = useState<number | null>(null)
  /** `shortcut`: a busca vem do `/termo` digitado no campo. `button`: busca própria do picker — o
   * raio nunca insere `/` na mensagem (QR-04). */
  const [quickRepliesMode, setQuickRepliesMode] = useState<'shortcut' | 'button'>('shortcut')
  const [caretPosition, setCaretPosition] = useState(0)
  const quickRepliesPopoverRef = useRef<HTMLDivElement>(null)
  const quickRepliesTriggerRef = useRef<HTMLButtonElement>(null)

  const isControlled = externalValue !== undefined
  const text = isControlled ? externalValue : internalText

  const setText = useCallback(
    (newText: string) => {
      if (isControlled) {
        externalOnChange?.(newText)
      } else {
        setInternalText(newText)
      }
    },
    [isControlled, externalOnChange],
  )

  const showEmojiButton = features?.emoji !== false
  const showAttachButton = features?.documents !== false
  const showQuickRepliesButton = Boolean(savedQuickReplies)

  // Deriva o picker só do texto até o cursor: digitar "/doc" abre, apagar a "/" fecha, e mover o
  // cursor para antes do atalho fecha também — sem isso o picker continuava aberto olhando para um
  // "/termo" que não é mais o que está na frente do cursor (a raiz do bug de caret).
  useEffect(() => {
    if (!showQuickRepliesButton || quickRepliesMode === 'button') return
    const match = detectQuickReplyShortcut(text.slice(0, caretPosition))
    setIsQuickRepliesOpen(Boolean(match))
    setQuickRepliesTerm(match?.term ?? '')
    setShortcutStart(match?.start ?? null)
  }, [text, caretPosition, showQuickRepliesButton, quickRepliesMode])

  useEffect(() => {
    if (!showQuickRepliesButton) setIsQuickRepliesOpen(false)
  }, [showQuickRepliesButton])

  const closeQuickReplies = useCallback(() => {
    setIsQuickRepliesOpen(false)
    setShortcutStart(null)
    setQuickRepliesTerm('')
    setQuickRepliesMode('shortcut')
  }, [])

  const closeQuickRepliesAndRefocus = useCallback(() => {
    closeQuickReplies()
    textareaRef.current?.focus()
  }, [closeQuickReplies])

  const trackCaret = useCallback((event: { currentTarget: HTMLTextAreaElement }) => {
    setCaretPosition(event.currentTarget.selectionStart)
  }, [])

  const insertSavedQuickReply = useCallback(
    (quickReply: SavedQuickReply) => {
      savedQuickReplies?.onSelect?.(quickReply)
      const ta = textareaRef.current
      if (!ta) return
      const resolvedBody = applyQuickReplyVariables(quickReply.body, savedQuickReplies?.variables)

      if (quickRepliesMode === 'button') {
        const start = ta.selectionStart
        const end = ta.selectionEnd
        const newText = text.slice(0, start) + resolvedBody + text.slice(end)
        setText(newText)
        closeQuickReplies()
        requestAnimationFrame(() => {
          ta.focus()
          const caret = start + resolvedBody.length
          ta.setSelectionRange(caret, caret)
        })
        return
      }

      if (shortcutStart === null) return
      // Faixa exata do atalho detectado (`/` + termo), nunca a posição atual do cursor — que pode
      // ter se movido para antes ou depois do "/termo" desde que ele foi digitado.
      const shortcutEnd = shortcutStart + 1 + quickRepliesTerm.length
      const { text: newText, caret } = replaceQuickReplyShortcut({
        text,
        start: shortcutStart,
        caret: shortcutEnd,
        replacement: resolvedBody,
      })
      setText(newText)
      closeQuickReplies()
      requestAnimationFrame(() => {
        ta.focus()
        ta.setSelectionRange(caret, caret)
      })
    },
    [text, setText, shortcutStart, quickRepliesTerm, quickRepliesMode, savedQuickReplies, closeQuickReplies],
  )

  const quickRepliesPicker = useQuickRepliesPicker({
    isOpen: isQuickRepliesOpen,
    search: quickRepliesTerm,
    listQuickReplies: savedQuickReplies?.listQuickReplies,
    quickReplyVariables: savedQuickReplies?.variables,
    onSelect: insertSavedQuickReply,
    onClose: closeQuickRepliesAndRefocus,
  })

  // Botão de raio: abre o picker com busca própria — o campo de mensagem não é tocado (QR-04).
  // Clicar de novo com o picker já aberto nesse modo fecha — o raio é um toggle, não só um "abrir".
  const openQuickRepliesViaButton = useCallback(() => {
    if (isQuickRepliesOpen && quickRepliesMode === 'button') {
      closeQuickRepliesAndRefocus()
      return
    }
    setQuickRepliesMode('button')
    setQuickRepliesTerm('')
    setShortcutStart(null)
    setIsQuickRepliesOpen(true)
  }, [isQuickRepliesOpen, quickRepliesMode, closeQuickRepliesAndRefocus])

  // Clique fora do popover em modo botão fecha e devolve o foco ao campo — a busca própria não
  // tem `blur` do campo para fechar sozinha, como o modo atalho tem. O próprio botão de raio é
  // ignorado aqui: o `mousedown` nele já é tratado por `openQuickRepliesViaButton` como toggle, e
  // sem essa exclusão o outside-click fechava primeiro e o `onClick` do botão reabria em seguida.
  useEffect(() => {
    if (!isQuickRepliesOpen || quickRepliesMode !== 'button') return
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (quickRepliesPopoverRef.current?.contains(target)) return
      if (quickRepliesTriggerRef.current?.contains(target)) return
      closeQuickRepliesAndRefocus()
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isQuickRepliesOpen, quickRepliesMode, closeQuickRepliesAndRefocus])

  const sendMessage = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed && attachments.length === 0) return
    if (trimmed) onSend(trimmed)
    for (const a of attachments) {
      onAttach?.(a.file)
      URL.revokeObjectURL(a.previewUrl)
    }
    if (!isControlled) setInternalText('')
    setAttachments([])
    setShowEmoji(false)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [text, attachments, onSend, onAttach, isControlled])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Em modo botão quem recebe as teclas é a busca própria do picker, não o campo.
      if (isQuickRepliesOpen && quickRepliesMode === 'shortcut') {
        quickRepliesPicker.handleKeyDown(e)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (!disabled) sendMessage()
      }
    },
    [sendMessage, disabled, isQuickRepliesOpen, quickRepliesMode, quickRepliesPicker],
  )

  const handleInput = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 100)}px`
  }, [])

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      const ta = textareaRef.current
      if (!ta) {
        setText(text + emoji)
        return
      }
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newText = text.slice(0, start) + emoji + text.slice(end)
      setText(newText)
      requestAnimationFrame(() => {
        ta.focus()
        ta.setSelectionRange(start + emoji.length, start + emoji.length)
        handleInput()
      })
    },
    [text, setText, handleInput],
  )

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const previews: FilePreview[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      previews.push({ file, previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '' })
    }
    setAttachments((prev) => [...prev, ...previews])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      const next = [...prev]
      if (next[index].previewUrl) URL.revokeObjectURL(next[index].previewUrl)
      next.splice(index, 1)
      return next
    })
  }, [])

  /**
   * Microfone por padrão, sem o host precisar compor nada.
   *
   * Antes o gravador era só um componente exportado e um slot vazio: cada inbox tinha que lembrar de
   * juntar os dois. Dois produtos, dois resultados — um ligou, o outro não, e a ausência não dava
   * erro nenhum. Um composer de WhatsApp sem microfone está incompleto, então o default certo é ter.
   *
   * Depende de `onAttach` porque áudio gravado é um arquivo para entregar, e microfone que grava sem
   * ter para onde mandar é pior que microfone nenhum — o operador fala e o áudio evapora. É a mesma
   * regra de capacidade usada no resto do pacote: sem a porta, a afordância não aparece.
   *
   * `idleAction` continua vencendo: quem já compunha o próprio gravador (com rótulos, limite de
   * duração ou revisão diferentes) não muda de comportamento ao atualizar.
   */
  const effectiveIdleAction =
    idleAction ?? (onAttach ? <AudioRecorderButton onRecorded={(file) => onAttach(file)} /> : undefined)

  const canSend = text.trim().length > 0 || attachments.length > 0
  const remaining = maxLength ? maxLength - text.length : null

  return (
    /* A barra é a superfície (cinza, largura cheia, sem raio) e o campo dentro é que arredonda —
       ordem do WhatsApp. Invertido, o pill arredondado ia até a borda da tela e os cantos
       descobriam o fundo branco da página, que lia como defeito. */
    <div className={cn(COMPOSER_BAR_CLASS, className)}>
      {/* Uma linha com scroll no celular e wrap no desktop: em 375px seis chips em wrap empurrariam
          o campo para fora da tela, e o campo é a razão de a barra existir. */}
      {quickReplies && quickReplies.length > 0 && (
        <div
          className={cn(
            'mb-2 flex flex-nowrap gap-1 overflow-x-auto px-1 sm:flex-wrap sm:overflow-x-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            classNames?.quickReplies,
          )}
        >
          {quickReplies.map((quickReply) => (
            <button
              data-cv-tooltip={quickReply.label}
              aria-label={quickReply.label}
              key={quickReply.key}
              type="button"
              // Preenche o campo em vez de enviar: mensagem pronta é ponto de partida, e quem
              // atende quase sempre ajusta uma palavra antes de mandar. Enviar direto no clique
              // transformaria um toque errado em mensagem entregue ao cliente.
              onClick={() => {
                setText(resolveQuickReply(quickReply, quickReplyVariables))
                textareaRef.current?.focus()
              }}
              className={cn(QUICK_REPLY_PILL_CLASS, classNames?.quickReply)}
            >
              {quickReply.label}
            </button>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex gap-2 px-1 pb-2 overflow-x-auto">
          {attachments.map((a, i) => (
            <div key={i} className="relative flex-shrink-0">
              {a.previewUrl ? (
                <img src={a.previewUrl} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
              ) : (
                <div className="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
              )}
              <button
                data-cv-tooltip={removeAttachmentLabel}
                aria-label={removeAttachmentLabel}
                onClick={() => removeAttachment(i)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-gray-600 text-white rounded-full flex items-center justify-center hover:bg-gray-800 text-xs"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={cn('flex items-end gap-1.5 rounded-xl bg-white px-3 py-2', classNames?.field)}>
        {showEmojiButton && (
          <div className="relative flex-shrink-0">
            <button
              data-cv-tooltip={emojiLabel}
              onClick={() => setShowEmoji((v) => !v)}
              className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
              aria-label={emojiLabel}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <circle cx="9" cy="9" r="0.5" fill="currentColor" />
                <circle cx="15" cy="9" r="0.5" fill="currentColor" />
              </svg>
            </button>
            {showEmoji && (
              <div className="absolute bottom-full left-0 mb-2 z-10">
                <EmojiPicker onSelect={handleEmojiSelect} />
              </div>
            )}
          </div>
        )}

        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setCaretPosition(e.target.selectionStart)
              handleInput()
            }}
            onKeyDown={handleKeyDown}
            onKeyUp={trackCaret}
            onClick={trackCaret}
            onSelect={trackCaret}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            role={showQuickRepliesButton ? 'combobox' : undefined}
            aria-expanded={showQuickRepliesButton ? isQuickRepliesOpen : undefined}
            aria-controls={showQuickRepliesButton ? quickRepliesListboxId : undefined}
            aria-activedescendant={
              isQuickRepliesOpen && quickRepliesMode === 'shortcut'
                ? `${quickRepliesListboxId}-option-${quickRepliesPicker.highlightedIndex}`
                : undefined
            }
            className="w-full resize-none bg-transparent text-[15px] text-[#3b4a54] placeholder-[#8696a0] outline-none py-1.5 max-h-[100px] leading-relaxed"
            style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
          />
          {isQuickRepliesOpen && (
            <div ref={quickRepliesPopoverRef} className="absolute bottom-full left-0 mb-2 z-10">
              <QuickRepliesPicker
                key={quickRepliesMode}
                id={quickRepliesListboxId}
                items={quickRepliesPicker.items}
                search={quickRepliesTerm}
                highlightedIndex={quickRepliesPicker.highlightedIndex}
                isLoading={quickRepliesPicker.isLoading}
                hasError={quickRepliesPicker.hasError}
                onHover={quickRepliesPicker.setHighlightedIndex}
                onSelect={insertSavedQuickReply}
                labels={savedQuickReplies?.labels}
                variables={savedQuickReplies?.variables}
                hasAttachmentsCapability={savedQuickReplies?.hasAttachmentsCapability}
                ownSearch={
                  quickRepliesMode === 'button'
                    ? {
                        value: quickRepliesTerm,
                        onChange: setQuickRepliesTerm,
                        onKeyDown: quickRepliesPicker.handleKeyDown,
                        label: quickRepliesLabel,
                      }
                    : undefined
                }
              />
            </div>
          )}
        </div>

        {showQuickRepliesButton && (
          <button
            ref={quickRepliesTriggerRef}
            type="button"
            data-cv-tooltip={quickRepliesLabel}
            aria-label={quickRepliesLabel}
            onClick={openQuickRepliesViaButton}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 flex-shrink-0 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </button>
        )}

        {showAttachButton && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={acceptedFileTypes}
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              data-cv-tooltip={attachLabel}
              onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 flex-shrink-0 transition-colors"
              aria-label={attachLabel}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
          </>
        )}

        {!canSend && effectiveIdleAction ? (
          <div className="flex-shrink-0">{effectiveIdleAction}</div>
        ) : (
          <button
            data-cv-tooltip={sendLabel}
            onClick={sendMessage}
            disabled={!canSend || disabled}
            className={`w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0 transition-all ${
              canSend && !disabled
                ? 'bg-[#00a884] text-white hover:bg-[#06cf9c] shadow-sm'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            aria-label={sendLabel}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        )}
      </div>

      {remaining !== null && (
        <div className="flex justify-end mt-1 pr-1">
          <span className={`text-xs ${remaining < 20 ? 'text-red-500' : 'text-gray-400'}`}>{remaining}</span>
        </div>
      )}
    </div>
  )
}
