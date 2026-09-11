import { cn } from '../lib/cn'
import { highlightMatch } from './quickReplySearch'
import type { QuickReply } from './quickReply.types'
import { DEFAULT_QUICK_REPLIES_PICKER_LABELS, type QuickRepliesPickerLabels } from './labels'

export type QuickRepliesPickerProps = {
  /** Id do `listbox`, para o campo apontar `aria-activedescendant` na opção destacada. */
  readonly id: string
  readonly items: readonly QuickReply[]
  readonly search: string
  readonly highlightedIndex: number
  readonly isLoading: boolean
  readonly error?: string
  readonly onHover: (index: number) => void
  readonly onSelect: (quickReply: QuickReply) => void
  readonly labels?: Partial<QuickRepliesPickerLabels>
  readonly className?: string
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
  error,
  onHover,
  onSelect,
  labels,
  className,
}: QuickRepliesPickerProps) {
  const text = { ...DEFAULT_QUICK_REPLIES_PICKER_LABELS, ...labels }

  return (
    <ul
      role="listbox"
      id={id}
      className={cn(
        'max-h-64 w-72 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900',
        className,
      )}
    >
      {isLoading ? <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{text.loading}</li> : null}
      {!isLoading && error ? (
        <li role="alert" className="px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error || text.error}
        </li>
      ) : null}
      {!isLoading && !error && items.length === 0 ? (
        <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
          {search.trim() ? text.noResults : text.empty}
        </li>
      ) : null}
      {!isLoading && !error
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
  )
}
