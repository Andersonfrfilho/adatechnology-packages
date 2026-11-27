/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useId, useState } from 'react'

import { EMOJI_BY_CATEGORY, EMOJI_CATEGORIES, searchEmoji, type EmojiCategory } from '../lib/emoji'
import { useContentText } from '../providers/ContentProvider'
import type { ContentMessages } from '../locales'

export type EmojiPickerProps = {
  readonly onPick: (emoji: string) => void
  readonly onClose: () => void
}

const CATEGORY_MESSAGE: Record<EmojiCategory, keyof ContentMessages> = {
  smileys: 'emojiSmileys',
  gestures: 'emojiGestures',
  food: 'emojiFood',
  nature: 'emojiNature',
  travel: 'emojiTravel',
  objects: 'emojiObjects',
  symbols: 'emojiSymbols',
}

export function EmojiPicker({ onPick, onClose }: EmojiPickerProps) {
  const { messages } = useContentText()
  const [category, setCategory] = useState<EmojiCategory>('smileys')
  const [query, setQuery] = useState('')
  const searchId = useId()
  const isSearching = query.trim().length > 0
  const visible = isSearching ? searchEmoji(query) : EMOJI_BY_CATEGORY[category]

  return (
    <div
      className="adc-popover adc-emoji"
      role="dialog"
      aria-label={messages.emojiTitle}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.stopPropagation()
        onClose()
      }}
    >
      <label htmlFor={searchId} className="adc-visually-hidden">
        {messages.emojiSearch}
      </label>
      <input
        id={searchId}
        type="text"
        role="searchbox"
        autoFocus
        placeholder={messages.emojiSearch}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.preventDefault()
        }}
      />
      {!isSearching && (
        <div className="adc-emoji-categories" role="group" aria-label={messages.emojiCategories}>
          {EMOJI_CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              className="adc-tab"
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
            >
              {messages[CATEGORY_MESSAGE[value]]}
            </button>
          ))}
        </div>
      )}
      {visible.length === 0 ? (
        <p className="adc-muted" role="status">
          {messages.emojiEmpty}
        </p>
      ) : (
        <div className="adc-emoji-grid">
          {visible.map((entry) => (
            <button
              key={entry.char}
              type="button"
              className="adc-emoji-button"
              aria-label={entry.keywords.split(' ')[0] ?? entry.char}
              onClick={() => onPick(entry.char)}
            >
              {entry.char}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
