/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Seleção sem `<select>` nativo: até três opções viram botões lado a lado (tudo à vista, um toque);
 * mais que isso, uma lista suspensa acessível (`listbox`) com teclado. O host troca pelo componente
 * do design system dele com `renderSelect`.
 */

import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

import { useRecipesContext, useRecipesText } from '../providers/RecipesProvider'
import type { SelectInputProps } from '../providers/types'

const BUTTON_GROUP_MAX_OPTIONS = 3
/** Acima disto a lista ganha um filtro digitável (insumos, produtos). */
const SEARCHABLE_MIN_OPTIONS = 9

function ButtonGroup(props: SelectInputProps) {
  return (
    <div className="arc-field" data-field={props.id}>
      <span className="arc-label" id={`${props.id}-label`}>
        {props.label}
      </span>
      <div className="arc-segmented" role="radiogroup" aria-labelledby={`${props.id}-label`} id={props.id}>
        {props.options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={option.id === props.value}
            className={`arc-segment${option.id === props.value ? ' arc-segment--on' : ''}`}
            onClick={() => props.onChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Listbox(props: SelectInputProps) {
  const { messages } = useRecipesText()
  const [isOpen, setIsOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const isSearchable = props.options.length >= SEARCHABLE_MIN_OPTIONS
  const visibleOptions = filter
    ? props.options.filter((option) => option.label.toLocaleLowerCase().includes(filter.toLocaleLowerCase()))
    : props.options
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(
      0,
      props.options.findIndex((option) => option.id === props.value),
    ),
  )
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = `${props.id}-list${useId().replace(/:/g, '')}`
  const selected = props.options.find((option) => option.id === props.value)

  useEffect(() => {
    if (!isOpen) return
    function handleOutside(event: MouseEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [isOpen])

  function choose(index: number): void {
    const option = visibleOptions[index]
    if (!option) return
    props.onChange(option.id)
    setIsOpen(false)
    setFilter('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const last = visibleOptions.length - 1
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((index) => (event.key === 'ArrowDown' ? Math.min(last, index + 1) : Math.max(0, index - 1)))
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActiveIndex(event.key === 'Home' ? 0 : last)
      return
    }
    if ((event.key === 'Enter' || event.key === ' ') && isOpen) {
      event.preventDefault()
      choose(activeIndex)
      return
    }
    if (event.key === 'Escape') setIsOpen(false)
  }

  const activeOption = visibleOptions[activeIndex]
  return (
    <div className="arc-field arc-listbox" data-field={props.id} ref={rootRef}>
      <span className="arc-label" id={`${props.id}-label`}>
        {props.label}
      </span>
      <button
        type="button"
        id={props.id}
        className="arc-input arc-listbox-button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-labelledby={`${props.id}-label ${props.id}`}
        aria-activedescendant={isOpen && activeOption ? `${listId}-${activeOption.id}` : undefined}
        onClick={() => setIsOpen((value) => !value)}
        onKeyDown={handleKeyDown}
      >
        <span>{selected?.label ?? ''}</span>
        <ChevronDown aria-hidden="true" className="arc-icon" />
      </button>
      {isOpen ? (
        <div className="arc-listbox-popover">
          {isSearchable ? (
            <input
              className="arc-input arc-listbox-filter"
              type="search"
              aria-label={messages.optionSearch}
              placeholder={messages.optionSearch}
              value={filter}
              autoFocus
              onChange={(event) => {
                setFilter(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === 'Escape')
                  handleKeyDown(event as unknown as KeyboardEvent<HTMLButtonElement>)
              }}
            />
          ) : null}
        <ul className="arc-listbox-list" role="listbox" id={listId} aria-labelledby={`${props.id}-label`}>
          {visibleOptions.length === 0 ? <li className="arc-listbox-empty">{messages.noOptions}</li> : null}
          {visibleOptions.map((option, index) => (
            <li
              key={option.id}
              id={`${listId}-${option.id}`}
              role="option"
              aria-selected={option.id === props.value}
              className={`arc-listbox-option${index === activeIndex ? ' arc-listbox-option--active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {option.id === props.value ? <Check aria-hidden="true" className="arc-icon" /> : null}
            </li>
          ))}
        </ul>
        </div>
      ) : null}
    </div>
  )
}

export function SelectField(props: SelectInputProps) {
  const { renderSelect } = useRecipesContext()
  if (renderSelect) return <>{renderSelect(props)}</>
  return props.options.length <= BUTTON_GROUP_MAX_OPTIONS ? <ButtonGroup {...props} /> : <Listbox {...props} />
}
