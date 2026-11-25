/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { buildPageItems } from '../lib/pagination'
import { useContentText, useRenderLink } from '../providers/ContentProvider'

export type PaginationProps = {
  readonly page: number
  readonly totalPages: number
  /** Com `getPageHref`, vira links (site público, SEO); sem, botões com `onPageChange` (painel). */
  readonly getPageHref?: (page: number) => string
  readonly onPageChange?: (page: number) => void
}

export function Pagination({ page, totalPages, getPageHref, onPageChange }: PaginationProps) {
  const { messages, format } = useContentText()
  const renderLink = useRenderLink()
  if (totalPages <= 1) return null

  function renderTarget(target: number, label: string, content: ReactNode, isCurrent = false) {
    const className = `adc-page${isCurrent ? ' adc-page--current' : ''}`
    if (getPageHref && !isCurrent)
      return renderLink({ href: getPageHref(target), className, 'aria-label': label, children: content })
    return (
      <button
        type="button"
        className={className}
        aria-label={label}
        aria-current={isCurrent ? 'page' : undefined}
        disabled={isCurrent}
        onClick={() => onPageChange?.(target)}
      >
        {content}
      </button>
    )
  }

  return (
    <nav className="adc-pagination" aria-label={messages.paginationLabel}>
      {page > 1 &&
        renderTarget(page - 1, messages.paginationPrevious, <ChevronLeft aria-hidden="true" className="adc-icon" />)}
      {buildPageItems({ current: page, total: totalPages }).map((item) =>
        item.kind === 'gap' ? (
          <span key={item.key} className="adc-page-gap" aria-hidden="true">
            …
          </span>
        ) : (
          <span key={item.page}>
            {renderTarget(item.page, format('pageLabel', { page: item.page }), item.page, item.page === page)}
          </span>
        ),
      )}
      {page < totalPages &&
        renderTarget(page + 1, messages.paginationNext, <ChevronRight aria-hidden="true" className="adc-icon" />)}
    </nav>
  )
}
