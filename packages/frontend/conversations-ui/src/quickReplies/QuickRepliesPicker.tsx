import { useEffect, useRef, type KeyboardEvent } from 'react'
import { cn } from '../lib/cn'
import { highlightMatch } from './quickReplySearch'
import type { QuickReply } from './quickReply.types'
import { DEFAULT_QUICK_REPLIES_PICKER_LABELS, type QuickRepliesPickerLabels } from './labels'

/**
 * Presente só no modo botão: o picker desenha e é dono da própria busca — focada ao abrir, dona de
 * seta/Enter/Esc. O campo de mensagem não é tocado (QR-04): abrir pelo raio nunca insere `/` nele.
 * Ausente, a busca vem do atalho `/termo` digitado no próprio campo, que continua no comando.
 */
export type QuickRepliesPickerOwnSearch = {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  readonly label: string
}

export type QuickRepliesPickerProps = {
  /** Id do `listbox`, para o campo (ou a busca própria) apontar `aria-activedescendant`. */
  readonly id: string
  readonly items: readonly QuickReply[]
  readonly search: string
  readonly highlightedIndex: number
  readonly isLoading: boolean
  /** Sinalizador puro — o texto exibido é sempre `labels.error`, nunca mensagem crua de exceção. */
  readonly hasError?: boolean
  readonly onHover: (index: number) => void
  readonly onSelect: (quickReply: QuickReply) => void
  readonly labels?: Partial<QuickRepliesPickerLabels>
  readonly className?: string
  readonly ownSearch?: QuickRepliesPickerOwnSearch
}

/**
 * Lista flutuante do atalho `/` e do botão de raio. Puramente controlada — todo estado (busca,
 * destaque, carregamento) vem de `useQuickRepliesPicker`, este componente só desenha.
 */
export function QuickRepliesPicker({
  id,
  items,
  search,
  highlightedIndex,
  isLoading,
  hasError,
  onHover,
  onSelect,
  labels,
  className,
  ownSearch,
}: QuickRepliesPickerProps) {
  const text = { ...DEFAULT_QUICK_REPLIES_PICKER_LABELS, ...labels }
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ownSearch) searchInputRef.current?.focus()
    // Só ao montar: o picker do modo botão nasce com a busca já em foco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeOptionId = items.length > 0 ? `${id}-option-${highlightedIndex}` : undefined

  return (
    <div className={className}>
      {ownSearch ? (
        <input
          ref={searchInputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={id}
          aria-activedescendant={activeOptionId}
          value={ownSearch.value}
          onChange={(event) => ownSearch.onChange(event.target.value)}
          onKeyDown={ownSearch.onKeyDown}
          placeholder={ownSearch.label}
          aria-label={ownSearch.label}
          className="mb-1 w-72 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-gray-900"
        />
      ) : null}
      <ul
        role="listbox"
        id={id}
        className="max-h-64 w-72 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
      >
        {isLoading ? <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{text.loading}</li> : null}
        {!isLoading && hasError ? (
          <li role="alert" className="px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {text.error}
          </li>
        ) : null}
        {!isLoading && !hasError && items.length === 0 ? (
          <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
            {search.trim() ? text.noResults : text.empty}
          </li>
        ) : null}
        {!isLoading && !hasError
          ? items.map((quickReply, index) => (
              <li
                key={quickReply.id}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === highlightedIndex}
                className={cn(
                  'flex cursor-pointer flex-col gap-0.5 px-3 py-2 text-sm',
                  index === highlightedIndex ? 'bg-gray-100 dark:bg-gray-800' : undefined,
                )}
                onMouseEnter={() => onHover(index)}
                // `mousedown` (não `click`): o campo mantém o foco, então o `blur` não fecha o
                // picker antes da seleção acontecer.
                onMouseDown={(event) => {
                  event.preventDefault()
                  onSelect(quickReply)
                }}
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">/{quickReply.shortcut}</span>
                  <span className="truncate font-medium">
                    {highlightMatch(quickReply.title, search).map((segment, segmentIndex) =>
                      segment.isMatch ? (
                        <mark key={segmentIndex} className="rounded-sm bg-yellow-200 dark:bg-yellow-700/60">
                          {segment.text}
                        </mark>
                      ) : (
                        <span key={segmentIndex}>{segment.text}</span>
                      ),
                    )}
                  </span>
                </span>
                <span className="truncate text-xs text-gray-500 dark:text-gray-400">{quickReply.body}</span>
              </li>
            ))
          : null}
      </ul>
    </div>
  )
}
