/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Select próprio, não o nativo do sistema. O `<select>` não aceita busca, não estiliza a lista
 * aberta e muda de forma entre navegadores — numa lista de recursos que cresce, isso vira rolagem
 * cega dentro de uma caixa que não se parece com o resto da tela (`web.md` §11).
 *
 * Sem Radix de propósito: nenhum dos pacotes de UI do ecossistema depende dele, e um pacote
 * publicado que três produtos consomem não ganha dependência de runtime por causa de um campo.
 */

import { Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'
import { filterSelectOptions, findByPrefix, type SelectOption } from './selectFilter.util'
import { FIELD_CONTROL, FIELD_LABEL } from './ui.constant'

export type { SelectOption }

export type SelectFieldProps = {
  readonly label: string
  readonly value: string
  readonly options: readonly SelectOption[]
  readonly onChange: (value: string) => void
  /** Rótulo da opção vazia. Ausente, o campo não oferece "nenhum". */
  readonly emptyOptionLabel?: string
  /** Ausente, a busca entra sozinha a partir de `SEARCHABLE_THRESHOLD` opções. */
  readonly searchable?: boolean
  /** Rótulo só para leitor de tela — para o campo que vive numa linha já rotulada. */
  readonly hideLabel?: boolean
  readonly className?: string
}

/** `web.md` §11: a partir daqui a lista precisa de busca. */
const SEARCHABLE_THRESHOLD = 8
const POPUP_MAX_HEIGHT = 288
const TYPEAHEAD_RESET_MS = 700

const OPTION_BASE = 'flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm'

export function SelectField({
  label,
  value,
  options,
  onChange,
  emptyOptionLabel,
  searchable,
  hideLabel,
  className,
}: SelectFieldProps) {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)
  const fieldId = useId()
  const listboxId = `${fieldId}-listbox`

  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typeahead = useRef<{ text: string; at: number }>({ text: '', at: 0 })

  const [isOpen, setIsOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)

  const allOptions = useMemo<readonly SelectOption[]>(
    () => (emptyOptionLabel === undefined ? options : [{ value: '', label: emptyOptionLabel }, ...options]),
    [emptyOptionLabel, options],
  )
  const withSearch = searchable ?? allOptions.length >= SEARCHABLE_THRESHOLD
  const visibleOptions = useMemo<readonly SelectOption[]>(
    () => (withSearch ? filterSelectOptions(allOptions, query) : allOptions),
    [allOptions, query, withSearch],
  )

  const selected = allOptions.find((option) => option.value === value)

  // Abre para cima quando a lista não cabe abaixo: os formulários vivem dentro de um painel que
  // rola, e uma lista que estoura o fundo dele sai cortada pelo `overflow`.
  function open(): void {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUpward(spaceBelow < POPUP_MAX_HEIGHT && rect.top > spaceBelow)
    }
    setQuery('')
    setHighlighted(Math.max(allOptions.findIndex((option) => option.value === value), 0))
    setIsOpen(true)
  }

  function close(returnFocus = true): void {
    setIsOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  function commit(option: SelectOption): void {
    onChange(option.value)
    close()
  }

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: PointerEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  useEffect(() => {
    if (isOpen && withSearch) searchRef.current?.focus()
  }, [isOpen, withSearch])

  useEffect(() => {
    if (!isOpen) return
    listRef.current?.children[highlighted]?.scrollIntoView({ block: 'nearest' })
  }, [highlighted, isOpen])

  /** Sem busca, digitar salta para a opção — o select nativo fazia isso, e não se perde aqui. */
  function jumpByTypeahead(key: string): boolean {
    if (withSearch || key.length !== 1 || !/\S/.test(key)) return false

    const now = Date.now()
    const text = now - typeahead.current.at > TYPEAHEAD_RESET_MS ? key : typeahead.current.text + key
    typeahead.current = { text, at: now }

    const index = findByPrefix(visibleOptions, text)
    if (index >= 0) setHighlighted(index)
    return index >= 0
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        open()
      }
      return
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        close()
        return
      case 'Tab':
        close(false)
        return
      case 'ArrowDown':
        event.preventDefault()
        setHighlighted((current) => Math.min(current + 1, visibleOptions.length - 1))
        return
      case 'ArrowUp':
        event.preventDefault()
        setHighlighted((current) => Math.max(current - 1, 0))
        return
      case 'Home':
        event.preventDefault()
        setHighlighted(0)
        return
      case 'End':
        event.preventDefault()
        setHighlighted(visibleOptions.length - 1)
        return
      case 'Enter': {
        event.preventDefault()
        const option = visibleOptions[highlighted]
        if (option) commit(option)
        return
      }
      default:
        if (jumpByTypeahead(event.key)) event.preventDefault()
    }
  }

  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      <span id={fieldId} className={hideLabel ? 'sr-only' : FIELD_LABEL}>
        {label}
      </span>

      <div ref={containerRef} className="relative">
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-labelledby={fieldId}
          onClick={() => (isOpen ? close(false) : open())}
          onKeyDown={handleKeyDown}
          className={`${FIELD_CONTROL} flex w-full items-center gap-2 text-left`}
        >
          <span className={`flex-1 truncate ${selected ? '' : 'text-gray-500 dark:text-gray-400'}`}>
            {selected?.label ?? emptyOptionLabel ?? ''}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <div
            className={`absolute z-30 w-full min-w-max overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'}`}
          >
            {withSearch && (
              <div className="flex items-center gap-2 border-b border-gray-200 px-3 dark:border-gray-700">
                <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setHighlighted(0)
                  }}
                  onKeyDown={handleKeyDown}
                  aria-label={messages['select.search']}
                  placeholder={messages['select.search']}
                  className="min-h-11 w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
                />
              </div>
            )}

            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-labelledby={fieldId}
              className="max-h-72 overflow-y-auto py-1"
            >
              {visibleOptions.map((option, index) => {
                const isSelected = option.value === value

                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    onPointerEnter={() => setHighlighted(index)}
                    onClick={() => commit(option)}
                    className={`${OPTION_BASE} ${index === highlighted ? 'bg-brand-50 dark:bg-brand-900/30' : ''} ${isSelected ? 'font-medium text-brand-800 dark:text-brand-200' : 'text-gray-800 dark:text-gray-200'}`}
                  >
                    <span className="flex-1 truncate">{option.label}</span>
                    {isSelected && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
                  </li>
                )
              })}

              {visibleOptions.length === 0 && (
                <li className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {messages['select.noResults']}
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
