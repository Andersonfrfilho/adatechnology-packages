import { useLayoutEffect, useRef, type ChangeEvent } from 'react'

import { Paperclip, Send } from 'lucide-react'

import { fitTextareaHeight } from './participantAutoGrow'
import type { ParticipantConversationsLabels } from './participantLabels'

type AttachControlProps = {
  readonly labels: ParticipantConversationsLabels
  readonly disabled: boolean
  readonly acceptedTypes?: readonly string[]
  readonly onChosen: (event: ChangeEvent<HTMLInputElement>) => void
}

export function AttachControl({ labels, disabled, acceptedTypes, onChosen }: AttachControlProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={fileInputRef}
        className="cv-p-composer__file-input"
        type="file"
        multiple
        hidden
        accept={acceptedTypes?.join(',')}
        onChange={onChosen}
      />
      <button
        type="button"
        className="cv-p-composer__attach"
        aria-label={labels.attach}
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
      >
        <Paperclip size={24} aria-hidden="true" focusable="false" />
      </button>
    </>
  )
}

export function SendButton({ label, disabled }: { readonly label: string; readonly disabled: boolean }) {
  return (
    <button
      type="submit"
      className="cv-p-button cv-p-button--primary cv-p-composer__send"
      aria-label={label}
      disabled={disabled}
    >
      <Send size={20} aria-hidden="true" focusable="false" />
    </button>
  )
}

type MessageFieldProps = {
  readonly value: string
  readonly label: string
  readonly placeholder: string
  readonly disabled: boolean
  readonly maxLength?: number
  readonly onChange: (value: string) => void
}

export function MessageField({ value, label, placeholder, disabled, maxLength, onChange }: MessageFieldProps) {
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    if (fieldRef.current) fitTextareaHeight(fieldRef.current)
  }, [value])

  return (
    <textarea
      ref={fieldRef}
      className="cv-p-composer__input"
      aria-label={label}
      placeholder={placeholder}
      rows={1}
      value={value}
      maxLength={maxLength}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
