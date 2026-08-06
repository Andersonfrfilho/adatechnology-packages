import { useState, useCallback, useMemo } from 'react'
import { EMOJI_CATEGORIES, searchEmojis, type EmojiEntry } from './emojiCatalog'

export interface EmojiPickerLabels {
  search: string
  noResults: string
}

export const DEFAULT_EMOJI_PICKER_LABELS: EmojiPickerLabels = {
  search: 'Buscar emoji',
  noResults: 'Nenhum emoji encontrado',
}

export interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  labels?: Partial<EmojiPickerLabels>
  className?: string
}

export const EmojiPicker = ({ onSelect, labels, className = '' }: EmojiPickerProps) => {
  const searchLabel = labels?.search ?? DEFAULT_EMOJI_PICKER_LABELS.search
  const noResultsLabel = labels?.noResults ?? DEFAULT_EMOJI_PICKER_LABELS.noResults
  const [activeCategory, setActiveCategory] = useState(0)
  const [query, setQuery] = useState('')

  const handleSelect = useCallback(
    (emoji: string) => {
      onSelect(emoji)
    },
    [onSelect],
  )

  // Buscando, as abas de categoria saem do caminho: o resultado atravessa todas elas, e manter uma
  // aba destacada sugeriria que a busca está restrita àquela categoria.
  const isSearching = query.trim().length > 0
  const visibleEntries: readonly EmojiEntry[] = useMemo(
    () => (isSearching ? searchEmojis(query) : EMOJI_CATEGORIES[activeCategory].entries),
    [isSearching, query, activeCategory],
  )

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden ${className}`}>
      <div className="p-2 border-b border-gray-200">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchLabel}
          aria-label={searchLabel}
          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
        />
      </div>

      {isSearching ? null : (
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {EMOJI_CATEGORIES.map((category, index) => (
            <button
              data-cv-tooltip={category.name} aria-label={category.name}
              key={category.name}
              onClick={() => setActiveCategory(index)}
              className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeCategory === index
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {category.entries[0].emoji} {category.name}
            </button>
          ))}
        </div>
      )}

      {visibleEntries.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-500">{noResultsLabel}</p>
      ) : (
        <div className="grid grid-cols-10 gap-0.5 p-2 max-h-[240px] overflow-y-auto">
          {visibleEntries.map((entry) => (
            <button
              key={entry.emoji}
              onClick={() => handleSelect(entry.emoji)}
              className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded transition-colors cursor-pointer"
              aria-label={entry.emoji}
              data-cv-tooltip={entry.keywords[0]}
            >
              {entry.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
