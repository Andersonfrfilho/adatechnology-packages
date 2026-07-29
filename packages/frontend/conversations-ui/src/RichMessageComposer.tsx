/**
 * Barra de composição do atendente: texto rico com a formatação do WhatsApp, respostas rápidas e
 * anexos.
 *
 * Distinto do `MessageComposer`, que é um `textarea` simples: aqui o operador vê o negrito em
 * negrito enquanto escreve, e não os asteriscos. Quem só precisa de uma caixa de texto continua no
 * `MessageComposer`.
 *
 * Nada aqui sabe de produto. O que aparece na barra é decidido por `toolbar`, o texto de cada dica
 * por `tooltips`, e as respostas rápidas chegam prontas por `quickReplies` — rótulo e conteúdo são
 * do host, a mecânica é daqui.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Bold, Italic, Strikethrough, Code, Paperclip, SendHorizonal, Braces } from 'lucide-react'

import { cn } from './lib/cn'
import { htmlToWA, waToHTML } from './lib/whatsapp-formatting'
import { SimpleEmojiPicker } from './SimpleEmojiPicker'
import { DEFAULT_ACCEPTED_FILE_TYPES } from './MessageComposer'

/** Cada ação que a barra sabe oferecer. `toolbar` decide quais delas aparecem. */
export const RICH_COMPOSER_ACTION = {
  BOLD: 'bold',
  ITALIC: 'italic',
  STRIKETHROUGH: 'strikethrough',
  MONOSPACE: 'monospace',
  EMOJI: 'emoji',
  ATTACH: 'attach',
  VARIABLES: 'variables',
} as const
export type RichComposerAction = (typeof RICH_COMPOSER_ACTION)[keyof typeof RICH_COMPOSER_ACTION]

/** Texto das dicas. O host troca só o que quiser; o resto fica no padrão. */
export interface RichComposerTooltips {
  bold: string
  italic: string
  strikethrough: string
  monospace: string
  emoji: string
  attach: string
  send: string
  variables: string
}

export const DEFAULT_RICH_COMPOSER_TOOLTIPS: RichComposerTooltips = {
  bold: 'Negrito',
  italic: 'Itálico',
  strikethrough: 'Tachado',
  monospace: 'Monoespaçado',
  emoji: 'Emojis',
  attach: 'Anexar arquivo',
  send: 'Enviar',
  variables: 'Variáveis disponíveis',
}

/**
 * Um valor que o operador pode inserir no texto sem digitar. `value` é o que entra no campo — pode
 * ser o dado já resolvido ("Anderson") ou um marcador a resolver depois ("{{nome}}"): quem decide é
 * o host, porque só ele sabe se a substituição acontece aqui ou no envio.
 */
export interface RichComposerVariable {
  id: string
  label: string
  value: string
  /** Prévia do que será inserido, para o operador conferir antes de tocar. */
  tooltip?: string
}

/** Uma resposta rápida: o que o operador lê no chip e o que cai no campo ao tocar nele. */
export interface RichComposerQuickReply {
  id: string
  label: string
  text: string
  /** Dica ao passar o mouse. Sem isto, o chip não tem `title` — rótulo curto já se explica. */
  tooltip?: string
}

/**
 * Cada formatação vira o elemento correspondente dentro do campo, não os asteriscos crus: o ponto
 * do editor rico é o operador ver o negrito em negrito. A conversão para a notação do WhatsApp
 * acontece na saída, no `htmlToWA`.
 */
const FORMATTING_ELEMENT = {
  bold: 'strong',
  italic: 'em',
  strikethrough: 'del',
  monospace: 'code',
} as const

const MONOSPACE_CLASS = 'bg-black/5 dark:bg-white/10 rounded px-0.5 font-mono text-sm'

/** Handle imperativo: `contentEditable` controlado pelo React perde o cursor a cada tecla. */
export interface RichMessageComposerHandle {
  setContent: (text: string) => void
  clear: () => void
  focus: () => void
}

export interface RichMessageComposerProps {
  /** Texto na notação do WhatsApp (`*negrito*`), não HTML. */
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onAttachFiles?: (files: FileList) => void
  quickReplies?: RichComposerQuickReply[]
  /** Variáveis que o operador pode inserir no texto. Vazio ou ausente, o botão não aparece. */
  variables?: RichComposerVariable[]
  /**
   * Quais ações aparecem. Ausente, todas aparecem — menos as que não têm como funcionar (anexo sem
   * `onAttachFiles` some sozinho, porque botão que não faz nada é pior que botão nenhum).
   */
  toolbar?: Partial<Record<RichComposerAction, boolean>>
  tooltips?: Partial<RichComposerTooltips>
  placeholder?: string
  disabled?: boolean
  isSending?: boolean
  /** Ocupa o lugar do enviar enquanto não há nada para enviar — onde o WhatsApp põe o microfone. */
  idleAction?: ReactNode
  /** Prévia dos anexos já escolhidos, desenhada pelo host acima da barra. */
  attachmentsPreview?: ReactNode
  acceptedFileTypes?: string
  className?: string
}

export const RichMessageComposer = forwardRef<RichMessageComposerHandle, RichMessageComposerProps>(function RichMessageComposer({
  value,
  onChange,
  onSend,
  onAttachFiles,
  quickReplies,
  variables,
  toolbar,
  tooltips,
  placeholder,
  disabled = false,
  isSending = false,
  idleAction,
  attachmentsPreview,
  acceptedFileTypes = DEFAULT_ACCEPTED_FILE_TYPES,
  className,
}, ref) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const variablesRef = useRef<HTMLDivElement>(null)
  const [isVariablesOpen, setIsVariablesOpen] = useState(false)

  useEffect(() => {
    if (!isVariablesOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!variablesRef.current?.contains(event.target as Node)) setIsVariablesOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [isVariablesOpen])

  const tooltipOf = (action: keyof RichComposerTooltips): string =>
    tooltips?.[action] ?? DEFAULT_RICH_COMPOSER_TOOLTIPS[action]
  const shows = (action: RichComposerAction): boolean => toolbar?.[action] !== false

  /** Escreve no campo sem passar pelo React: `contentEditable` controlado perde o cursor a cada tecla. */
  const replaceContent = useCallback((text: string) => {
    const editor = editorRef.current
    if (!editor) return
    editor.innerHTML = waToHTML(text)
    onChange(htmlToWA(editor.innerHTML))
    editor.focus()
  }, [onChange])

  useImperativeHandle(ref, () => ({
    setContent: replaceContent,
    clear: () => {
      const editor = editorRef.current
      if (!editor) return
      editor.innerHTML = ''
      onChange('')
    },
    focus: () => editorRef.current?.focus(),
  }), [onChange, replaceContent])

  /** Range vivo dentro do campo, ou `undefined` se o cursor está em outro lugar da página. */
  const currentRange = useCallback((): Range | undefined => {
    const editor = editorRef.current
    if (!editor) return undefined
    editor.focus()
    const selection = window.getSelection()
    if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return undefined
    return selection.getRangeAt(0)
  }, [])

  const commitRange = useCallback((range: Range, node: Node) => {
    const selection = window.getSelection()
    range.setStartAfter(node)
    range.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(range)
    onChange(htmlToWA(editorRef.current?.innerHTML ?? ''))
  }, [onChange])

  const insertAtCursor = useCallback((fragment: string) => {
    const range = currentRange()
    if (!range) return
    range.deleteContents()
    const textNode = document.createTextNode(fragment)
    range.insertNode(textNode)
    commitRange(range, textNode)
  }, [commitRange, currentRange])

  /**
   * Envolve a seleção no elemento da formatação. Sem seleção não faz nada: abrir a marcação e
   * esperar que o operador digite dentro dela é o caminho que sai com marcador sobrando quando ele
   * clica noutro lugar antes.
   */
  const wrapSelection = useCallback((action: keyof typeof FORMATTING_ELEMENT) => {
    const range = currentRange()
    const selectedText = range?.toString()
    if (!range || !selectedText) return
    range.deleteContents()
    const wrapper = document.createElement(FORMATTING_ELEMENT[action])
    if (action === 'monospace') wrapper.className = MONOSPACE_CLASS
    wrapper.textContent = selectedText
    range.insertNode(wrapper)
    commitRange(range, wrapper)
  }, [commitRange, currentRange])

  const handleInput = useCallback((event: FormEvent<HTMLDivElement>) => {
    onChange(htmlToWA(event.currentTarget.innerHTML))
  }, [onChange])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (!disabled) onSend()
    }
  }, [disabled, onSend])

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) onAttachFiles?.(event.target.files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [onAttachFiles])

  const canSend = value.trim().length > 0

  return (
    <div className={cn('flex flex-col', className)}>
      {attachmentsPreview}

      {quickReplies?.length ? (
        /* Uma linha só, rolando na horizontal. Deixar quebrar em várias linhas faz a barra crescer
           conforme o número de respostas rápidas e empurrar a conversa para cima — o composer
           precisa ter altura previsível, independente de quantos atalhos o host configurou. */
        <div className="mb-2 flex flex-nowrap gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {quickReplies.map((quickReply) => (
            <button
              key={quickReply.id}
              type="button"
              title={quickReply.tooltip}
              onClick={() => replaceContent(quickReply.text)}
              className="flex-shrink-0 whitespace-nowrap rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-teal-800 dark:hover:bg-teal-950/40 dark:hover:text-teal-400"
            >
              {quickReply.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        {/* Só no desktop: no celular não há como selecionar texto e tocar no botão sem perder a
            seleção, e a formatação sai digitada à mão de qualquer jeito. */}
        <div className="mb-0.5 hidden items-center gap-0.5 sm:flex">
          {([
            [RICH_COMPOSER_ACTION.BOLD, Bold],
            [RICH_COMPOSER_ACTION.ITALIC, Italic],
            [RICH_COMPOSER_ACTION.STRIKETHROUGH, Strikethrough],
            [RICH_COMPOSER_ACTION.MONOSPACE, Code],
          ] as const)
            .filter(([action]) => shows(action))
            .map(([action, Icon]) => (
              <button
                key={action}
                type="button"
                onClick={() => wrapSelection(action)}
                title={tooltipOf(action)}
                aria-label={tooltipOf(action)}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-teal-50 hover:text-teal-600 dark:text-gray-500 dark:hover:bg-teal-900/30 dark:hover:text-teal-400"
              >
                <Icon size={15} />
              </button>
            ))}
        </div>

        {shows(RICH_COMPOSER_ACTION.EMOJI) ? (
          <SimpleEmojiPicker onSelect={insertAtCursor} label={tooltipOf('emoji')} />
        ) : null}

        {variables?.length && shows(RICH_COMPOSER_ACTION.VARIABLES) ? (
          <div ref={variablesRef} className="relative">
            <button
              type="button"
              onClick={() => setIsVariablesOpen((open) => !open)}
              title={tooltipOf('variables')}
              aria-label={tooltipOf('variables')}
              aria-expanded={isVariablesOpen}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-teal-50 hover:text-teal-600 dark:text-gray-500 dark:hover:bg-teal-900/30 dark:hover:text-teal-400"
            >
              <Braces size={18} />
            </button>
            {isVariablesOpen ? (
              <div className="absolute bottom-full left-0 z-20 mb-2 max-h-56 w-64 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                {variables.map((variable) => (
                  <button
                    key={variable.id}
                    type="button"
                    title={variable.tooltip ?? variable.value}
                    onClick={() => { insertAtCursor(variable.value); setIsVariablesOpen(false) }}
                    className="flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-teal-50 dark:hover:bg-teal-950/40"
                  >
                    <span className="text-sm text-gray-800 dark:text-gray-100">{variable.label}</span>
                    <span className="font-mono text-xs text-gray-400 dark:text-gray-500">{variable.value}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {onAttachFiles && shows(RICH_COMPOSER_ACTION.ATTACH) ? (
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
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title={tooltipOf('attach')}
              aria-label={tooltipOf('attach')}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-teal-50 hover:text-teal-600 dark:text-gray-500 dark:hover:bg-teal-900/30 dark:hover:text-teal-400"
            >
              <Paperclip size={18} />
            </button>
          </>
        ) : null}

        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder}
          data-placeholder={placeholder}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          style={{ minHeight: '36px', maxHeight: '120px' }}
          className="flex-1 min-w-[180px] overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-800 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-300 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 dark:empty:before:text-gray-500 before:pointer-events-none [&_strong]:font-semibold [&_em]:italic [&_del]:line-through [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-0.5 [&_code]:font-mono [&_code]:text-sm dark:[&_code]:bg-white/10"
        />

        {!canSend && idleAction ? (
          <div className="flex-shrink-0">{idleAction}</div>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={disabled || isSending || !canSend}
            title={tooltipOf('send')}
            aria-label={tooltipOf('send')}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-teal-600 text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSending ? <span className="text-xs">⏳</span> : <SendHorizonal size={16} />}
          </button>
        )}
      </div>
    </div>
  )
})
