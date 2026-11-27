/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Barra da lista: busca sempre primeiro e à esquerda, depois os filtros (tags), "Limpar filtros", e as
 * ações à direita.
 */

import type { TagCount } from '@adatechnology/content-contracts'
import { formatTagLabel } from '@adatechnology/content-contracts'
import { Plus, RotateCcw, Search } from 'lucide-react'
import { useId, type ReactNode } from 'react'

import { useContentText } from '../providers/ContentProvider'

export type PostListToolbarProps = {
  readonly search: string
  readonly onSearch: (value: string) => void
  readonly tags: readonly TagCount[] | undefined
  readonly selectedTags: readonly string[]
  readonly onToggleTag: (tag: string) => void
  readonly hasFilters: boolean
  readonly onClear: () => void
  readonly onCreate: (() => void) | undefined
}

export function PostListToolbar(props: PostListToolbarProps): ReactNode {
  const { messages } = useContentText()
  const searchId = useId()
  return (
    <div className="adc-list-toolbar">
      <div className="adc-list-toolbar__filters">
        <div className="adc-field adc-field--search">
          <label htmlFor={searchId} className="adc-visually-hidden">
            {messages.searchLabel}
          </label>
          <div className="adc-input-icon">
            <Search aria-hidden="true" className="adc-icon" />
            <input
              id={searchId}
              type="text"
              inputMode="search"
              autoComplete="off"
              placeholder={messages.searchPlaceholder}
              value={props.search}
              onChange={(event) => props.onSearch(event.target.value)}
            />
          </div>
        </div>
        {props.tags && props.tags.length > 0 && (
          <div className="adc-tag-toggles" role="group" aria-label={messages.filterTag}>
            {props.tags.slice(0, 12).map((entry) => (
              <button
                key={entry.tag}
                type="button"
                className="adc-tag-toggle"
                aria-pressed={props.selectedTags.includes(entry.tag)}
                onClick={() => props.onToggleTag(entry.tag)}
              >
                {formatTagLabel(entry.tag)}
                <span className="adc-tag-toggle__count">{entry.count}</span>
              </button>
            ))}
          </div>
        )}
        {props.hasFilters && (
          <button type="button" className="adc-button adc-button--ghost" onClick={props.onClear}>
            <RotateCcw aria-hidden="true" className="adc-icon" />
            {messages.clearFilters}
          </button>
        )}
      </div>
      {props.onCreate && (
        <button type="button" className="adc-button adc-button--primary" onClick={props.onCreate}>
          <Plus aria-hidden="true" className="adc-icon" />
          {messages.newPost}
        </button>
      )}
    </div>
  )
}
