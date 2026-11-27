/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { buildPageItems } from '../lib/pagination'
import { PAGE_SIZE_OPTIONS } from '../lib/listUrlState'
import { useCouponsText } from '../providers/CouponsProvider'
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
  const { messages, format } = useCouponsText()
  return (
    <div className="acp-pagination-bar">
      <SelectField
        id={`${id}-page-size`}
        label={messages.pageSize}
        value={String(pageSize)}
        options={PAGE_SIZE_OPTIONS.map((size) => ({ id: String(size), label: String(size) }))}
        onChange={(value) => onPageSizeChange(Number(value))}
      />
      {totalPages > 1 ? (
        <nav className="acp-pagination" aria-label={messages.paginationLabel}>
          <button
            type="button"
            className="acp-page"
            aria-label={messages.paginationPrevious}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft aria-hidden="true" className="acp-icon" />
          </button>
          {buildPageItems({ current: page, total: totalPages }).map((item) =>
            item.kind === 'gap' ? (
              <span key={item.key} className="acp-page-gap" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={item.page}
                type="button"
                className={`acp-page${item.page === page ? ' acp-page--current' : ''}`}
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
            className="acp-page"
            aria-label={messages.paginationNext}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight aria-hidden="true" className="acp-icon" />
          </button>
        </nav>
      ) : null}
    </div>
  )
}
