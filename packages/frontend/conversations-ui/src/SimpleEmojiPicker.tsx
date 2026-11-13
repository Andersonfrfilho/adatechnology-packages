import { useEffect, useRef, useState } from 'react'
import { Smile } from 'lucide-react'

const EMOJIS = [
  '😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😜', '🤪', '😎',
  '🤩', '😇', '🙂', '😏', '😌', '😔', '😢', '😭', '😤', '😡',
  '🥺', '😰', '😱', '🥳', '🤔', '🤗', '👍', '👎', '👏', '🙌',
  '🤝', '💪', '🙏', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤',
  '🤍', '💔', '🔥', '⭐', '🎉', '✨', '💯', '✅', '❌', '⚠️',
  '🚀', '💡', '📌', '📎', '📝', '📊', '📈', '💰', '💳', '🏠',
  '🏦', '🚗', '✈️', '⏰', '📅', '🔔', '📞', '💬', '🗨️', '👋',
  '🤖', '🎯', '🏆', '📋', '📄', '🔍', '🎓', '🌟', '💼', '🛡️',
]

export interface SimpleEmojiPickerProps {
  onSelect: (emoji: string) => void
  label?: string
  pickerWidth?: string
  pickerMaxHeight?: string
}

// Paridade com financiamento-imobiliario-bot/apps/web/src/components/SimpleEmojiPicker.tsx —
// grade única (sem categorias), botão de alternância com fecho ao clicar fora. Distinto do
// EmojiPicker categorizado já existente no pacote, que é sempre-aberto/multi-categoria.
export function SimpleEmojiPicker({ onSelect, label = 'Emojis', pickerWidth = '280px', pickerMaxHeight = '220px' }: SimpleEmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors"
        data-cv-tooltip={label}
        aria-label={label}
      >
        <Smile size={18} />
      </button>

      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl p-2 z-50">
          <div
            className="grid grid-cols-10 gap-0.5 overflow-y-auto"
            style={{ width: pickerWidth, maxHeight: pickerMaxHeight }}
          >
            {EMOJIS.map((emoji) => (
              <button
                data-cv-tooltip={emoji} aria-label={emoji}
                key={emoji}
                type="button"
                onClick={() => { onSelect(emoji); setOpen(false) }}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-lg leading-none transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
