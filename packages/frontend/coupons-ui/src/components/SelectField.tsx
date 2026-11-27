/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Seleção sem `<select>` nativo: até três opções viram botões lado a lado (tudo à vista, um toque);
 * mais que isso, uma lista suspensa acessível (`listbox`) com teclado. O host troca pelo componente
 * do design system dele com `renderSelect`.
 */

import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

import { useCouponsContext } from '../providers/CouponsProvider'
import type { SelectInputProps } from '../providers/types'

const BUTTON_GROUP_MAX_OPTIONS = 3

function ButtonGroup(props: SelectInputProps) {
  return (
    <div className="acp-field" data-field={props.id}>
      <span className="acp-label" id={`${props.id}-label`}>
        {props.label}
      </span>
      <div className="acp-segmented" role="radiogroup" aria-labelledby={`${props.id}-label`} id={props.id}>
        {props.options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={option.id === props.value}
            className={`acp-segment${option.id === props.value ? ' acp-segment--on' : ''}`}
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
  const [isOpen, setIsOpen] = useState(false)
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
    const option = props.options[index]
    if (!option) return
    props.onChange(option.id)
    setIsOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const last = props.options.length - 1
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

  const activeOption = props.options[activeIndex]
  return (
    <div className="acp-field acp-listbox" data-field={props.id} ref={rootRef}>
      <span className="acp-label" id={`${props.id}-label`}>
        {props.label}
      </span>
      <button
        type="button"
        id={props.id}
        className="acp-input acp-listbox-button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-labelledby={`${props.id}-label ${props.id}`}
        aria-activedescendant={isOpen && activeOption ? `${listId}-${activeOption.id}` : undefined}
        onClick={() => setIsOpen((value) => !value)}
        onKeyDown={handleKeyDown}
      >
        <span>{selected?.label ?? ''}</span>
        <ChevronDown aria-hidden="true" className="acp-icon" />
      </button>
      {isOpen ? (
        <ul className="acp-listbox-list" role="listbox" id={listId} aria-labelledby={`${props.id}-label`}>
          {props.options.map((option, index) => (
            <li
              key={option.id}
              id={`${listId}-${option.id}`}
              role="option"
              aria-selected={option.id === props.value}
              className={`acp-listbox-option${index === activeIndex ? ' acp-listbox-option--active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {option.id === props.value ? <Check aria-hidden="true" className="acp-icon" /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function SelectField(props: SelectInputProps) {
  const { renderSelect } = useCouponsContext()
  if (renderSelect) return <>{renderSelect(props)}</>
  return props.options.length <= BUTTON_GROUP_MAX_OPTIONS ? <ButtonGroup {...props} /> : <Listbox {...props} />
}
