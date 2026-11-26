import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { ProductsMultiSelectRenderProps, ProductsSelectOption, ProductsSelectRenderProps } from './listing.types'

type DefaultMenuProps = {
  readonly id: string
  readonly label: string
  readonly options: readonly ProductsSelectOption[]
  readonly selected: readonly string[]
  readonly isMultiple: boolean
  readonly summary: string
  readonly onToggle: (optionId: string) => void
}

// Menu de reserva: o host que tem `Select` próprio o injeta por `renderSelect`/`renderMultiSelect`.
function DefaultMenu({ id, label, options, selected, isMultiple, summary, onToggle }: DefaultMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return undefined
    function handlePointerDown(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  function handleOptionClick(optionId: string): void {
    onToggle(optionId)
    if (!isMultiple) setIsOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${label}: ${summary}`}
        onClick={() => setIsOpen((value) => !value)}
        className="inline-flex min-h-11 min-w-36 items-center justify-between gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
      >
        <span className="truncate">{summary}</span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-500" />
      </button>
      {isOpen ? (
        <ul
          role="listbox"
          aria-label={label}
          aria-multiselectable={isMultiple}
          className="absolute left-0 z-30 mt-1 max-h-64 min-w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {options.map((option) => (
            <li key={option.id} role="option" aria-selected={selected.includes(option.id)}>
              <button
                type="button"
                onClick={() => handleOptionClick(option.id)}
                className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
              >
                <Check aria-hidden="true" className={`h-4 w-4 shrink-0 text-brand-600 ${selected.includes(option.id) ? '' : 'invisible'}`} />
                <span className="whitespace-nowrap">{option.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function DefaultSelect({ id, label, value, options, onChange }: ProductsSelectRenderProps) {
  const current = options.find((option) => option.id === value)
  return (
    <DefaultMenu
      id={id}
      label={label}
      options={options}
      selected={[value]}
      isMultiple={false}
      summary={current?.label ?? label}
      onToggle={onChange}
    />
  )
}

export function DefaultMultiSelect({ id, label, values, options, onChange }: ProductsMultiSelectRenderProps) {
  const first = options.find((option) => option.id === values[0])
  const summary = values.length === 0 ? label : values.length === 1 ? (first?.label ?? label) : `${label} (${values.length})`

  function handleToggle(optionId: string): void {
    onChange(values.includes(optionId) ? values.filter((value) => value !== optionId) : [...values, optionId])
  }

  return (
    <DefaultMenu
      id={id}
      label={label}
      options={options}
      selected={values}
      isMultiple
      summary={summary}
      onToggle={handleToggle}
    />
  )
}
