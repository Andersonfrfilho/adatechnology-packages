/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { normalizeTags, TAGS_MAX_COUNT } from '@adatechnology/content-contracts'
import { X } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'

import { splitTagInput } from '../lib/postDraft'
import { useContentText } from '../providers/ContentProvider'

export type TagsInputProps = {
  readonly value: readonly string[]
  readonly onChange: (tags: string[]) => void
  readonly suggestions?: readonly string[]
  readonly label: string
}

export function TagsInput({ value, onChange, suggestions = [], label }: TagsInputProps) {
  const { messages, format } = useContentText()
  const [text, setText] = useState('')
  const inputId = useId()
  const listId = useId()

  function commit(raw: string): void {
    const added = splitTagInput(raw)
    if (added.length > 0) onChange(normalizeTags([...value, ...added]))
    setText('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit(text)
    } else if (event.key === 'Backspace' && !text && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="adc-field">
      <label htmlFor={inputId}>{label}</label>
      <div className="adc-tags-input">
        {value.map((tag) => (
          <span key={tag} className="adc-tag">
            {tag}
            <button
              type="button"
              className="adc-tag-remove"
              aria-label={format('tagRemove', { tag })}
              onClick={() => onChange(value.filter((current) => current !== tag))}
            >
              <X aria-hidden="true" className="adc-icon" />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          value={text}
          list={suggestions.length > 0 ? listId : undefined}
          disabled={value.length >= TAGS_MAX_COUNT}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(text)}
          aria-describedby={`${inputId}-hint`}
        />
      </div>
      <small id={`${inputId}-hint`} className="adc-hint">
        {messages.tagsHint}
      </small>
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions
            .filter((tag) => !value.includes(tag))
            .map((tag) => (
              <option key={tag} value={tag} />
            ))}
        </datalist>
      )}
    </div>
  )
}
