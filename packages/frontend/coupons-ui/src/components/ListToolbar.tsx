/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Search, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useCouponsText } from '../providers/CouponsProvider'

export type ListToolbarProps = {
  readonly id: string
  readonly search: string
  readonly searchPlaceholder: string
  readonly onSearchChange: (search: string) => void
  readonly total: number | undefined
  /** Filtros estruturados, depois da busca. */
  readonly filters?: ReactNode
  readonly hasFilters: boolean
  readonly onClearFilters: () => void
  /** Ações da lista, à direita (exportar, novo). */
  readonly actions?: ReactNode
}

/** Busca primeiro e mais larga; filtros; ações à direita; total sempre visível; quebra linha no celular. */
export function ListToolbar(props: ListToolbarProps) {
  const { messages, format } = useCouponsText()
  const [draft, setDraft] = useState(props.search)
  const debounced = useDebouncedValue(draft)
  const { onSearchChange, search } = props

  useEffect(() => {
    if (debounced !== search) onSearchChange(debounced)
  }, [debounced, search, onSearchChange])

  // "Limpar filtros" de fora zera também o que está digitado.
  useEffect(() => setDraft(search), [search])

  return (
    <div className="acp-toolbar" role="search">
      <div className="acp-search">
        <label className="acp-visually-hidden" htmlFor={`${props.id}-search`}>
          {messages.searchLabel}
        </label>
        <Search aria-hidden="true" className="acp-icon" />
        <input
          id={`${props.id}-search`}
          className="acp-input acp-search-input"
          type="search"
          value={draft}
          placeholder={props.searchPlaceholder}
          onChange={(event) => setDraft(event.target.value)}
        />
      </div>
      {props.filters}
      {props.hasFilters ? (
        <button type="button" className="acp-button acp-button--ghost" onClick={props.onClearFilters}>
          <X aria-hidden="true" className="acp-icon" />
          <span>{messages.clearFilters}</span>
        </button>
      ) : null}
      <span className="acp-total" aria-live="polite">
        {props.total === undefined
          ? ''
          : props.total === 1
            ? messages.resultCountOne
            : format('resultCount', { count: props.total })}
      </span>
      <div className="acp-toolbar-actions">{props.actions}</div>
    </div>
  )
}
