/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A barra da caixa de mensagem: negrito, itálico, tachado, monoespaçado e emoji.
 *
 * Ela escreve MARCAÇÃO no texto, não HTML. A convenção é a do WhatsApp (`conversation-flow.md` §4)
 * e vale para todos os canais — quem escreve o fluxo escreve uma vez, e o canal que não a entende
 * nativamente traduz na renderização. Um editor rico que cuspisse `<b>` obrigaria o mesmo texto a
 * existir duas vezes, e a segunda cópia sempre atrasa em relação à primeira.
 */

import { Bold, Code, Italic, Smile, Strikethrough } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { MESSAGE_EMOJI, MESSAGE_FORMAT, MESSAGE_FORMAT_MARKS } from '../messageFormat.constant'
import type { MessageFormat } from '../messageFormat.constant'

export type MessageToolbarProps = {
  /** Aplica o delimitador na seleção corrente do campo. */
  readonly onMark: (delimiter: string) => void
  readonly onInsert: (text: string) => void
  /** Rótulos acessíveis, por formato. Nada aqui é literal (web.md §6). */
  readonly labelOf: (key: string) => string
}

const FORMAT_ICON: Readonly<Record<MessageFormat, ReactNode>> = {
  [MESSAGE_FORMAT.BOLD]: <Bold aria-hidden="true" className="adn-settings__button-icon" />,
  [MESSAGE_FORMAT.ITALIC]: <Italic aria-hidden="true" className="adn-settings__button-icon" />,
  [MESSAGE_FORMAT.STRIKETHROUGH]: <Strikethrough aria-hidden="true" className="adn-settings__button-icon" />,
  [MESSAGE_FORMAT.MONOSPACE]: <Code aria-hidden="true" className="adn-settings__button-icon" />,
}

export function MessageToolbar({ onMark, onInsert, labelOf }: MessageToolbarProps) {
  const [isEmojiOpen, setIsEmojiOpen] = useState(false)

  return (
    <div className="adn-toolbar">
      {MESSAGE_FORMAT_MARKS.map(({ format, delimiter }) => (
        <button
          key={format}
          type="button"
          className="adn-toolbar__button"
          title={labelOf(`toolbar.${format}`)}
          aria-label={labelOf(`toolbar.${format}`)}
          /**
           * `onMouseDown` e não `onClick`: clicar tira o foco do campo, e com ele a seleção que a
           * barra precisa envolver. Prevenir o padrão mantém o cursor onde estava.
           */
          onMouseDown={(event) => {
            event.preventDefault()
            onMark(delimiter)
          }}
        >
          {FORMAT_ICON[format]}
        </button>
      ))}

      <span className="adn-toolbar__divider" aria-hidden="true" />

      <div className="adn-toolbar__emoji">
        <button
          type="button"
          className="adn-toolbar__button"
          title={labelOf('toolbar.emoji')}
          aria-label={labelOf('toolbar.emoji')}
          aria-expanded={isEmojiOpen}
          onMouseDown={(event) => {
            event.preventDefault()
            setIsEmojiOpen((current) => !current)
          }}
        >
          <Smile aria-hidden="true" className="adn-settings__button-icon" />
        </button>

        {isEmojiOpen && (
          <div className="adn-toolbar__palette" role="group" aria-label={labelOf('toolbar.emoji')}>
            {MESSAGE_EMOJI.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="adn-toolbar__emoji-button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  onInsert(emoji)
                  setIsEmojiOpen(false)
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
