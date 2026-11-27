/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { buildPageItems, PAGE_SIZE_OPTIONS } from '../lib/pagination'
import { useRecipesText } from '../providers/RecipesProvider'
import { SelectField } from './SelectField'

export type PaginationProps = {
  readonly id: string
  readonly page: number
  readonly totalPages: number
  readonly pageSize: number
  readonly onPageChange: (page: number) => void
  readonly onPageSizeChange: (pageSize: number) => void
}

/** Componente único de paginação: página atual, total de páginas e itens por página. */
export function Pagination({ id, page, totalPages, pageSize, onPageChange, onPageSizeChange }: PaginationProps) {
  const { messages, format } = useRecipesText()
  return (
    <div className="arc-pagination-bar">
      <SelectField
        id={`${id}-page-size`}
        label={messages.pageSize}
        value={String(pageSize)}
        options={PAGE_SIZE_OPTIONS.map((size) => ({ id: String(size), label: String(size) }))}
        onChange={(value) => onPageSizeChange(Number(value))}
      />
      {totalPages > 1 ? (
        <nav className="arc-pagination" aria-label={messages.paginationLabel}>
          <button
            type="button"
            className="arc-page"
            aria-label={messages.paginationPrevious}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft aria-hidden="true" className="arc-icon" />
          </button>
          {buildPageItems({ current: page, total: totalPages }).map((item) =>
            item.kind === 'gap' ? (
              <span key={item.key} className="arc-page-gap" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={item.page}
                type="button"
                className={`arc-page${item.page === page ? ' arc-page--current' : ''}`}
                aria-label={format('pageLabel', { page: item.page })}
                aria-current={item.page === page ? 'page' : undefined}
                disabled={item.page === page}
                onClick={() => onPageChange(item.page)}
              >
                {item.page}
              </button>
            ),
          )}
          <button
            type="button"
            className="arc-page"
            aria-label={messages.paginationNext}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight aria-hidden="true" className="arc-icon" />
          </button>
        </nav>
      ) : null}
    </div>
  )
}
