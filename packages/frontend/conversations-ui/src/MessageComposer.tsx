import { useState, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react'
import type { ConversationsFeatures } from './types'
import { EmojiPicker } from './EmojiPicker'

export interface MessageComposerProps {
  onSend: (text: string) => void
  onAttach?: (file: File) => void
  value?: string
  onChange?: (value: string) => void
  features?: ConversationsFeatures
  placeholder?: string
  maxLength?: number
  disabled?: boolean
}

interface FilePreview {
  file: File
  previewUrl: string
}

export const MessageComposer = ({
  onSend,
  onAttach,
  value: externalValue,
  onChange: externalOnChange,
  features,
  placeholder = 'Digite uma mensagem...',
  maxLength,
  disabled = false,
}: MessageComposerProps) => {
  const [internalText, setInternalText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [attachments, setAttachments] = useState<FilePreview[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isControlled = externalValue !== undefined
  const text = isControlled ? externalValue : internalText

  const setText = useCallback((newText: string) => {
    if (isControlled) {
      externalOnChange?.(newText)
    } else {
      setInternalText(newText)
    }
  }, [isControlled, externalOnChange])

  const showEmojiButton = features?.emoji !== false
  const showAttachButton = features?.documents !== false

  const sendMessage = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed && attachments.length === 0) return
    if (trimmed) onSend(trimmed)
    for (const a of attachments) {
      onAttach?.(a.file)
      URL.revokeObjectURL(a.previewUrl)
    }
    if (!isControlled) setInternalText('')
    setAttachments([])
    setShowEmoji(false)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [text, attachments, onSend, onAttach, isControlled])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled) sendMessage()
    }
  }, [sendMessage, disabled])

  const handleInput = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 100)}px`
  }, [])

  const handleEmojiSelect = useCallback((emoji: string) => {
    const ta = textareaRef.current
    if (!ta) { setText(text + emoji); return }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const newText = text.slice(0, start) + emoji + text.slice(end)
    setText(newText)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + emoji.length, start + emoji.length)
      handleInput()
    })
  }, [text, setText, handleInput])

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const previews: FilePreview[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      previews.push({ file, previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '' })
    }
    setAttachments(prev => [...prev, ...previews])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => {
      const next = [...prev]
      if (next[index].previewUrl) URL.revokeObjectURL(next[index].previewUrl)
      next.splice(index, 1)
      return next
    })
  }, [])

  const insertFormatting = useCallback((marker: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart; const end = ta.selectionEnd
    const sel = text.slice(start, end)
    if (sel) {
      setText(text.slice(0, start) + marker + sel + marker + text.slice(end))
      requestAnimationFrame(() => {
        ta.focus()
        ta.setSelectionRange(start + marker.length + sel.length + marker.length, start + marker.length + sel.length + marker.length)
      })
    }
  }, [text, setText])

  const canSend = text.trim().length > 0 || attachments.length > 0
  const remaining = maxLength ? maxLength - text.length : null

  return (
    <div>
      {attachments.length > 0 && (
        <div className="flex gap-2 px-1 pb-2 overflow-x-auto">
          {attachments.map((a, i) => (
            <div key={i} className="relative flex-shrink-0">
              {a.previewUrl ? (
                <img src={a.previewUrl} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
              ) : (
                <div className="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
              )}
              <button onClick={() => removeAttachment(i)} className="absolute -top-2 -right-2 w-5 h-5 bg-gray-600 text-white rounded-full flex items-center justify-center hover:bg-gray-800 text-xs">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5 bg-[#f0f2f5] rounded-xl px-3 py-2">
        {showEmojiButton && (
          <div className="relative flex-shrink-0">
            <button onClick={() => setShowEmoji(v => !v)} className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 transition-colors" aria-label="Emoji">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="9" r="0.5" fill="currentColor"/><circle cx="15" cy="9" r="0.5" fill="currentColor"/></svg>
            </button>
            {showEmoji && (
              <div className="absolute bottom-full left-0 mb-2 z-10">
                <EmojiPicker onSelect={handleEmojiSelect} />
              </div>
            )}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => { setText(e.target.value); handleInput() }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent text-[15px] text-[#3b4a54] placeholder-[#8696a0] outline-none py-1.5 max-h-[100px] leading-relaxed"
          style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
        />

        {showAttachButton && (
          <>
            <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 flex-shrink-0 transition-colors" aria-label="Anexar">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
          </>
        )}

        <button
          onClick={sendMessage}
          disabled={!canSend || disabled}
          className={`w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0 transition-all ${
            canSend && !disabled
              ? 'bg-[#00a884] text-white hover:bg-[#06cf9c] shadow-sm'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
          aria-label="Enviar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>

      {remaining !== null && (
        <div className="flex justify-end mt-1 pr-1">
          <span className={`text-xs ${remaining < 20 ? 'text-red-500' : 'text-gray-400'}`}>{remaining}</span>
        </div>
      )}
    </div>
  )
}
