/**
 * Peças de listagem que toda tela tabular do pacote precisa ter iguais: cabeçalho ordenável,
 * filtro de seleção múltipla, barra de ação em lote e paginação (regra `web.md` §7).
 *
 * Vivem aqui, e não dentro de cada tela, porque a alternativa já se provou pior: cada workspace
 * recriava o seu, e o mesmo "limpar filtros" ficava em três lugares com três comportamentos.
 */

import { useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, X } from 'lucide-react'

import { cn } from '../lib/cn'

export type SortDirection = 'asc' | 'desc'

export interface SortableHeadProps {
  readonly label: string
  readonly field: string
  readonly activeField: string
  readonly direction: SortDirection
  readonly onSort: (field: string) => void
  readonly className?: string
}

export function SortableHead({ label, field, activeField, direction, onSort, className }: SortableHeadProps) {
  const isActive = activeField === field
  const Icon = !isActive ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown

  return (
    <th scope="col" className={cn('px-3 py-2 text-left text-xs font-medium', className)}>
      <button
        data-cv-tooltip={label}
        type="button"
        onClick={() => onSort(field)}
        aria-label={label}
        className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100"
      >
        {label}
        <Icon size={12} className={isActive ? '' : 'opacity-40'} aria-hidden="true" />
      </button>
    </th>
  )
}

export interface FilterOption {
  readonly value: string
  readonly label: string
}

export interface MultiSelectFilterProps {
  readonly label: string
  readonly options: readonly FilterOption[]
  readonly selected: readonly string[]
  readonly onChange: (selected: readonly string[]) => void
  readonly className?: string
}

export function MultiSelectFilter({ label, options, selected, onChange, className }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)

  function toggle(value: string): void {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])
  }

  return (
    <div className={cn('relative', className)}>
      <button
        data-cv-tooltip={label} aria-label={label}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="cv-header-action inline-flex items-center gap-1"
      >
        {label}
        {selected.length > 0 ? <span className="cv-filter-count">{selected.length}</span> : null}
        <ChevronDown size={12} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} aria-hidden="true" />
      </button>

      {open ? (
        <>
          {/* Sem a camada de fundo o dropdown só fechava clicando de novo no botão, e ficava aberto
              por cima da tabela enquanto o usuário tentava clicar numa linha. */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="cv-filter-menu">
            {options.map((option) => (
              <label key={option.value} className="cv-filter-option">
                <input
                  type="checkbox"
                  checked={selected.includes(option.value)}
                  onChange={() => toggle(option.value)}
                  className="cursor-pointer rounded border-gray-300 text-blue-600 dark:border-gray-600"
                />
                {option.label}
              </label>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

export interface BulkActionBarProps {
  readonly selectedCount: number
  readonly selectedLabel: (count: number) => string
  readonly clearLabel: string
  readonly onClear: () => void
  readonly children?: ReactNode
}

export function BulkActionBar({ selectedCount, selectedLabel, clearLabel, onClear, children }: BulkActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="cv-bulk-bar" role="toolbar" aria-label={selectedLabel(selectedCount)}>
      <span className="text-xs font-medium">{selectedLabel(selectedCount)}</span>
      {children}
      <button data-cv-tooltip={clearLabel} aria-label={clearLabel} type="button" onClick={onClear} className="cv-header-action ml-auto inline-flex items-center gap-1">
        <X size={12} aria-hidden="true" />
        {clearLabel}
      </button>
    </div>
  )
}

export interface ListingPaginationProps {
  readonly page: number
  readonly total: number
  readonly perPage: number
  readonly perPageOptions?: readonly number[]
  readonly onPageChange: (page: number) => void
  readonly onPerPageChange?: (perPage: number) => void
  readonly labels: {
    readonly show: string
    readonly perPage: string
    readonly total: (count: number) => string
    readonly page: (current: number, last: number) => string
    readonly previous: string
    readonly next: string
  }
}

export function ListingPagination({
  page,
  total,
  perPage,
  perPageOptions,
  onPageChange,
  onPerPageChange,
  labels,
}: ListingPaginationProps) {
  const lastPage = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="cv-listing-pagination">
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        {onPerPageChange && perPageOptions ? (
          <>
            <span>{labels.show}</span>
            <select
              value={perPage}
              onChange={(event) => onPerPageChange(Number(event.target.value))}
              aria-label={labels.perPage}
              className="cv-listing-perpage"
            >
              {perPageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span>{labels.perPage}</span>
          </>
        ) : null}
        <span className="ml-1">{labels.total(total)}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          data-cv-tooltip={labels.previous}
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label={labels.previous}
          className="cv-header-icon disabled:opacity-40"
        >
          ‹
        </button>
        <span className="text-xs text-gray-500">{labels.page(page, lastPage)}</span>
        <button
          data-cv-tooltip={labels.next}
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= lastPage}
          aria-label={labels.next}
          className="cv-header-icon disabled:opacity-40"
        >
          ›
        </button>
      </div>
    </div>
  )
}
