import { useState, useCallback } from 'react'

export interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  className?: string
}

const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: 'Smileys',
    emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😋', '😛', '😜', '🤪'],
  },
  {
    name: 'Gestures',
    emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '🤝', '🙏', '✍️', '💅', '🤳'],
  },
  {
    name: 'Hearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️'],
  },
  {
    name: 'Food',
    emojis: ['🍔', '🍟', '🍕', '🌭', '🍿', '🧂', '🥓', '🥚', '🍳', '🧇', '🥞', '🧈', '🍞', '🥐', '🥨', '🥯', '🥖', '🧀', '🥗', '🥙'],
  },
  {
    name: 'Drinks',
    emojis: ['☕', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🥤', '🧋', '🧃', '🧉', '🧊', '🥢', '🍽️', '🍴', '🥄'],
  },
  {
    name: 'Objects',
    emojis: ['🎁', '🎂', '🎈', '🎉', '🎊', '🎀', '📱', '💻', '⌚', '📷', '🔑', '💰', '💳', '📝', '📌', '📍', '✂️', '🔍', '💡', '🔔'],
  },
]

export const EmojiPicker = ({ onSelect, className = '' }: EmojiPickerProps) => {
  const [activeCategory, setActiveCategory] = useState(0)

  const handleSelect = useCallback(
    (emoji: string) => {
      onSelect(emoji)
    },
    [onSelect],
  )

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden ${className}`}>
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {EMOJI_CATEGORIES.map((category, index) => (
          <button
            key={category.name}
            onClick={() => setActiveCategory(index)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeCategory === index
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {category.emojis[0]} {category.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-10 gap-0.5 p-2 max-h-[240px] overflow-y-auto">
        {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleSelect(emoji)}
            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded transition-colors cursor-pointer"
            aria-label={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
