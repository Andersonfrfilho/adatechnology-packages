/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A caixa de mensagem com barra de formatação.
 *
 * A seleção é assunto do DOM, e por isso ela mora aqui e não no `useTemplateEditor`: o hook guarda
 * o rascunho, este componente guarda onde o cursor está. Depois de cada botão a seleção é
 * reposicionada à mão — sem isso o cursor pula para o fim do texto a cada clique, e quem estava
 * corrigindo o meio de uma frase perde o lugar.
 */

import { useLayoutEffect, useRef, useState } from 'react'

import { applyMark, insertAt } from '../messageFormat.util'
import { MessageToolbar } from './MessageToolbar'

export type MessageBodyFieldProps = {
  readonly value: string
  readonly rows?: number
  readonly onChange: (value: string) => void
  readonly onSelect?: (cursorIndex: number) => void
  readonly onFocus?: () => void
  readonly labelOf: (key: string) => string
}

export function MessageBodyField({ value, rows = 5, onChange, onSelect, onFocus, labelOf }: MessageBodyFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [pendingSelection, setPendingSelection] = useState<readonly [number, number]>()

  /**
   * `useLayoutEffect` e não `useEffect`: a seleção precisa ser reposta ANTES da pintura, senão o
   * cursor aparece por um quadro no lugar errado — e num campo de texto esse piscar é visível.
   */
  useLayoutEffect(() => {
    if (!pendingSelection) return
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.focus()
    textarea.setSelectionRange(pendingSelection[0], pendingSelection[1])
    setPendingSelection(undefined)
  }, [pendingSelection])

  function currentRange(): readonly [number, number] {
    const textarea = textareaRef.current
    if (!textarea) return [value.length, value.length]
    return [textarea.selectionStart, textarea.selectionEnd]
  }

  function handleMark(delimiter: string): void {
    const [selectionStart, selectionEnd] = currentRange()
    const result = applyMark({ text: value, delimiter, selectionStart, selectionEnd })

    onChange(result.text)
    setPendingSelection([result.selectionStart, result.selectionEnd])
  }

  function handleInsert(insertion: string): void {
    const [selectionStart, selectionEnd] = currentRange()
    const result = insertAt({ text: value, insertion, selectionStart, selectionEnd })

    onChange(result.text)
    setPendingSelection([result.selectionStart, result.selectionEnd])
  }

  return (
    <div className="adn-message-field">
      <MessageToolbar onMark={handleMark} onInsert={handleInsert} labelOf={labelOf} />
      <textarea
        ref={textareaRef}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onSelect={(event) => onSelect?.(event.currentTarget.selectionStart)}
        onFocus={onFocus}
      />
    </div>
  )
}
