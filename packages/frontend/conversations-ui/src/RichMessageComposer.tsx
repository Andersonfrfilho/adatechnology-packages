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
import { Bold, Italic, Strikethrough, Code, Paperclip, SendHorizonal, Braces, Type } from 'lucide-react'

import { cn } from './lib/cn'
import {
  COMPOSER_BAR_CLASS,
  COMPOSER_COMPACT_WIDTH,
  COMPOSER_MONOSPACE_CLASS,
  COMPOSER_TOOL_BUTTON_ACTIVE_CLASS,
  COMPOSER_TOOL_BUTTON_CLASS,
  COMPOSER_TOOL_BUTTON_IDLE_CLASS,
  QUICK_REPLY_PILL_CLASS,
} from './composer.constant'
import { useContainerWidth } from './hooks/useContainerWidth'
import {
  FORMATTING_ACTION,
  activeFormattingIn,
  codeAncestorOf,
  exitMonospaceAfter,
  isFormattingActive,
  startMonospaceAt,
  toggleFormattingCommand,
  unwrapMonospace,
  type FormattingAction,
} from './lib/composer-formatting'
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
  /** Botão que abre a formatação recolhida, quando a barra está estreita demais para os quatro. */
  formatting: string
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
  formatting: 'Formatação',
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
  /**
   * Há anexo na fila esperando envio. O campo não conhece a fila — é do host — e sem essa dica ele
   * concluía que não havia nada a enviar: com uma imagem anexada e nenhum texto, o botão de enviar
   * dava lugar ao `idleAction` e a imagem ficava presa.
   */
  hasQueuedAttachments?: boolean
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
  hasQueuedAttachments = false,
  acceptedFileTypes = DEFAULT_ACCEPTED_FILE_TYPES,
  className,
}, ref) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const variablesRef = useRef<HTMLDivElement>(null)
  const formattingRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [isVariablesOpen, setIsVariablesOpen] = useState(false)
  const [isFormattingOpen, setIsFormattingOpen] = useState(false)
  const [activeFormatting, setActiveFormatting] = useState('')

  const barWidth = useContainerWidth(barRef)
  const isCompact = barWidth !== undefined && barWidth < COMPOSER_COMPACT_WIDTH

  /**
   * O último texto que este campo emitiu. É o que distingue o eco do próprio `onChange` — que deve
   * ser ignorado, senão o cursor volta ao início a cada tecla — de um `value` vindo de fora, que
   * precisa ser escrito no campo. Sem essa distinção o texto continuava na tela depois de enviado.
   */
  const lastEmittedRef = useRef('')

  const emitChange = useCallback((html: string) => {
    const text = htmlToWA(html)
    lastEmittedRef.current = text
    onChange(text)
  }, [onChange])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || value === lastEmittedRef.current) return
    lastEmittedRef.current = value
    editor.innerHTML = waToHTML(value)
  }, [value])

  const refreshActiveFormatting = useCallback(() => {
    const editor = editorRef.current
    if (editor) setActiveFormatting(activeFormattingIn(editor))
  }, [])

  // `selectionchange` é do documento: não existe evento de "o cursor andou" no próprio campo.
  useEffect(() => {
    document.addEventListener('selectionchange', refreshActiveFormatting)
    return () => document.removeEventListener('selectionchange', refreshActiveFormatting)
  }, [refreshActiveFormatting])

  useEffect(() => {
    if (!isVariablesOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!variablesRef.current?.contains(event.target as Node)) setIsVariablesOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [isVariablesOpen])

  useEffect(() => {
    if (!isFormattingOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!formattingRef.current?.contains(event.target as Node)) setIsFormattingOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [isFormattingOpen])

  // A barra voltou a ser larga (a prévia fechou): os botões reaparecem na linha e o popover ficaria
  // aberto ancorado num botão que não existe mais.
  useEffect(() => {
    if (!isCompact) setIsFormattingOpen(false)
  }, [isCompact])

  const tooltipOf = (action: keyof RichComposerTooltips): string =>
    tooltips?.[action] ?? DEFAULT_RICH_COMPOSER_TOOLTIPS[action]
  const shows = (action: RichComposerAction): boolean => toolbar?.[action] !== false

  /** Escreve no campo sem passar pelo React: `contentEditable` controlado perde o cursor a cada tecla. */
  const replaceContent = useCallback((text: string) => {
    const editor = editorRef.current
    if (!editor) return
    editor.innerHTML = waToHTML(text)
    emitChange(editor.innerHTML)
    editor.focus()
  }, [emitChange])

  useImperativeHandle(ref, () => ({
    setContent: replaceContent,
    clear: () => {
      const editor = editorRef.current
      if (!editor) return
      editor.innerHTML = ''
      emitChange('')
    },
    focus: () => editorRef.current?.focus(),
  }), [emitChange, replaceContent])

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
    emitChange(editorRef.current?.innerHTML ?? '')
  }, [emitChange])

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
    if (action === 'monospace') wrapper.className = COMPOSER_MONOSPACE_CLASS
    wrapper.textContent = selectedText
    range.insertNode(wrapper)
    commitRange(range, wrapper)
  }, [commitRange, currentRange])

  /**
   * Uma regra só para os quatro botões, a mesma dos editores de texto:
   *
   * - cursor vago — liga ou desliga daqui para a frente, sem tocar no que já está escrito;
   * - com seleção — aplica na seleção, ou tira dela se ela já estiver toda formatada.
   *
   * `execCommand` faz isso sozinho para negrito, itálico e tachado. Monoespaçado não tem comando
   * nativo e é feito à mão, com a mesma regra. Onde nem o comando existe (ambiente sem editor de
   * verdade), sobra o wrap da seleção — que era tudo o que a barra fazia antes.
   */
  const applyFormatting = useCallback((action: FormattingAction) => {
    const editor = editorRef.current
    const range = currentRange()
    if (!editor || !range) return

    if (action === FORMATTING_ACTION.MONOSPACE) {
      const code = codeAncestorOf({ node: range.startContainer, editor })
      if (range.collapsed) {
        if (code) exitMonospaceAfter(code)
        else startMonospaceAt(range)
      } else if (code) {
        unwrapMonospace(code)
      } else {
        wrapSelection(action)
      }
      emitChange(editor.innerHTML)
      refreshActiveFormatting()
      return
    }

    if (toggleFormattingCommand(action)) emitChange(editor.innerHTML)
    else wrapSelection(action)
    refreshActiveFormatting()
  }, [currentRange, emitChange, refreshActiveFormatting, wrapSelection])

  const handleInput = useCallback((event: FormEvent<HTMLDivElement>) => {
    emitChange(event.currentTarget.innerHTML)
    refreshActiveFormatting()
  }, [emitChange, refreshActiveFormatting])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      // Sem esta guarda, cada Enter durante o upload dispara outro envio — foi o que duplicou a imagem.
      if (!disabled && !isSending) onSend()
    }
  }, [disabled, isSending, onSend])

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) onAttachFiles?.(event.target.files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [onAttachFiles])

  const canSend = value.trim().length > 0 || hasQueuedAttachments

  // Os mesmos botões servem à linha e ao popover: duas listas separadas divergiriam na primeira
  // formatação nova.
  const formattingButtons = ([
    [RICH_COMPOSER_ACTION.BOLD, Bold],
    [RICH_COMPOSER_ACTION.ITALIC, Italic],
    [RICH_COMPOSER_ACTION.STRIKETHROUGH, Strikethrough],
    [RICH_COMPOSER_ACTION.MONOSPACE, Code],
  ] as const)
    .filter(([action]) => shows(action))
    .map(([action, Icon]) => {
      const isActive = isFormattingActive({ active: activeFormatting, action })
      return (
        <button
          key={action}
          type="button"
          // O clique tira o foco do campo antes do `onClick`, e com ele a seleção que a
          // formatação precisa — segurar o mousedown é o que mantém o cursor onde está.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyFormatting(action)}
          data-cv-tooltip={tooltipOf(action)}
          aria-label={tooltipOf(action)}
          aria-pressed={isActive}
          className={cn(
            COMPOSER_TOOL_BUTTON_CLASS,
            isActive ? COMPOSER_TOOL_BUTTON_ACTIVE_CLASS : COMPOSER_TOOL_BUTTON_IDLE_CLASS,
          )}
        >
          <Icon size={18} />
        </button>
      )
    })

  return (
    <div className={cn(COMPOSER_BAR_CLASS, 'flex flex-col', className)}>
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
              data-cv-tooltip={quickReply.tooltip} aria-label={quickReply.tooltip}
              onClick={() => replaceContent(quickReply.text)}
              className={cn(QUICK_REPLY_PILL_CLASS, 'flex-shrink-0')}
            >
              {quickReply.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Uma escala só para a barra inteira: todo botão é 36px com ícone de 18, o mesmo gap entre
          todos e nenhuma margem própria. Com tamanhos e espaçamentos diferentes por grupo, o
          `items-end` alinhava as bases mas os ícones ficavam em alturas e ritmos distintos. */}
      {/* Uma linha só, e ela não quebra: `flex-nowrap` com o campo em `min-w-0` faz o texto ceder
          espaço quando a coluna estreita — que é o que ligar a prévia faz — em vez de empurrar
          botão para uma segunda faixa. */}
      <div ref={barRef} className="flex flex-nowrap items-end gap-1">
        {/* Formatação só no desktop: no celular não há como selecionar texto e tocar no botão sem
            perder a seleção, e a formatação sai digitada à mão de qualquer jeito.

            Com a barra estreita os quatro recolhem num botão só. Ceder a largura ao campo é a
            escolha certa aqui: escrever é a ação da barra, formatar é o acessório — e é o campo,
            não o botão, que fica inutilizável quando encolhe. */}
        {formattingButtons.length > 0 ? (
          isCompact ? (
            <div ref={formattingRef} className="relative hidden flex-shrink-0 sm:block">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setIsFormattingOpen((open) => !open)}
                data-cv-tooltip={tooltipOf('formatting')}
                aria-label={tooltipOf('formatting')}
                aria-expanded={isFormattingOpen}
                className={cn(
                  COMPOSER_TOOL_BUTTON_CLASS,
                  activeFormatting || isFormattingOpen
                    ? COMPOSER_TOOL_BUTTON_ACTIVE_CLASS
                    : COMPOSER_TOOL_BUTTON_IDLE_CLASS,
                )}
              >
                <Type size={18} />
              </button>
              {isFormattingOpen ? (
                <div className="absolute bottom-full left-0 z-20 mb-2 flex items-center gap-1 rounded-full border border-gray-200 bg-white px-1 py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  {formattingButtons}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="hidden flex-shrink-0 items-center gap-1 sm:flex">{formattingButtons}</div>
          )
        ) : null}

        {shows(RICH_COMPOSER_ACTION.EMOJI) ? (
          <SimpleEmojiPicker onSelect={insertAtCursor} label={tooltipOf('emoji')} />
        ) : null}

        {variables?.length && shows(RICH_COMPOSER_ACTION.VARIABLES) ? (
          <div ref={variablesRef} className="relative">
            <button
              type="button"
              onClick={() => setIsVariablesOpen((open) => !open)}
              data-cv-tooltip={tooltipOf('variables')}
              aria-label={tooltipOf('variables')}
              aria-expanded={isVariablesOpen}
              className={cn(COMPOSER_TOOL_BUTTON_CLASS, COMPOSER_TOOL_BUTTON_IDLE_CLASS)}
            >
              <Braces size={18} />
            </button>
            {isVariablesOpen ? (
              <div className="absolute bottom-full left-0 z-20 mb-2 max-h-56 w-64 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                {variables.map((variable) => (
                  <button
                    key={variable.id}
                    type="button"
                    data-cv-tooltip={variable.tooltip ?? variable.value} aria-label={variable.tooltip ?? variable.value}
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
              data-cv-tooltip={tooltipOf('attach')}
              aria-label={tooltipOf('attach')}
              className={cn(COMPOSER_TOOL_BUTTON_CLASS, COMPOSER_TOOL_BUTTON_IDLE_CLASS)}
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
          // `min-w-0` em vez de uma largura mínima em px: com o mínimo fixo o campo se recusava a
          // encolher junto com a coluna e era ele quem estourava a linha ao ligar a prévia.
          className="ml-1 min-w-0 flex-1 overflow-y-auto rounded-2xl border border-transparent bg-white px-4 py-2 text-sm text-gray-800 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-300 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 dark:empty:before:text-gray-500 before:pointer-events-none [&_strong]:font-semibold [&_b]:font-semibold [&_em]:italic [&_i]:italic [&_del]:line-through [&_s]:line-through [&_strike]:line-through [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-0.5 [&_code]:font-mono [&_code]:text-sm dark:[&_code]:bg-white/10"
        />

        {!canSend && idleAction ? (
          <div className="flex-shrink-0">{idleAction}</div>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={disabled || isSending || !canSend}
            data-cv-tooltip={tooltipOf('send')}
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
