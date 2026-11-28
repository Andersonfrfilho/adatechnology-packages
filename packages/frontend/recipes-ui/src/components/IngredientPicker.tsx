/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Busca de insumo no servidor enquanto digita (a empresa pode ter centenas): combobox acessível,
 * setas e Enter escolhem, Esc fecha.
 */

import type { Ingredient } from '@adatechnology/recipe-contracts'
import { Search } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent } from 'react'

import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useRecipesApi, useRecipesText } from '../providers/RecipesProvider'

const RESULTS = 10

export type IngredientPickerProps = {
  readonly id: string
  readonly onPick: (ingredient: Ingredient) => void
  /** Já na receita: aparecem, mas desabilitados. */
  readonly excludedIds?: ReadonlySet<string>
}

export function IngredientPicker({ id, onPick, excludedIds }: IngredientPickerProps) {
  const api = useRecipesApi()
  const { messages } = useRecipesText()
  const [text, setText] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<readonly Ingredient[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const search = useDebouncedValue(text)

  useEffect(() => {
    if (!isOpen) return
    let isCurrent = true
    api
      .listIngredients({ page: 1, pageSize: RESULTS, sort: 'name', order: 'asc', ...(search.trim() ? { search: search.trim() } : {}) })
      .then((page) => isCurrent && setOptions(page.data))
      .catch(() => isCurrent && setOptions([]))
    return () => {
      isCurrent = false
    }
  }, [api, search, isOpen])

  function pick(ingredient: Ingredient | undefined): void {
    if (!ingredient || excludedIds?.has(ingredient.id)) return
    onPick(ingredient)
    setText('')
    setIsOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((index) => Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))))
    } else if (event.key === 'Enter' && isOpen) {
      event.preventDefault()
      pick(options[activeIndex])
    } else if (event.key === 'Escape') setIsOpen(false)
  }

  const listId = `${id}-results`
  return (
    <div className="arc-field arc-listbox">
      <label className="arc-label" htmlFor={id}>
        {messages.addLine}
      </label>
      <div className="arc-search">
        <Search aria-hidden="true" className="arc-icon" />
        <input
          id={id}
          className="arc-input arc-search-input"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={isOpen && options[activeIndex] ? `${listId}-${options[activeIndex].id}` : undefined}
          placeholder={messages.ingredientSearchPlaceholder}
          value={text}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onChange={(event) => {
            setText(event.target.value)
            setActiveIndex(0)
            setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />
      </div>
      {isOpen ? (
        <ul className="arc-listbox-list" role="listbox" id={listId}>
          {options.length === 0 ? <li className="arc-listbox-empty">{messages.ingredientSearchEmpty}</li> : null}
          {options.map((ingredient, index) => {
            const isExcluded = excludedIds?.has(ingredient.id) ?? false
            return (
              <li
                key={ingredient.id}
                id={`${listId}-${ingredient.id}`}
                role="option"
                aria-selected={index === activeIndex}
                aria-disabled={isExcluded}
                className={`arc-listbox-option${index === activeIndex ? ' arc-listbox-option--active' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(ingredient)}
              >
                <span>{ingredient.name}</span>
                <span className="arc-chip">{messages[`unit_${ingredient.unit}`]}</span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
