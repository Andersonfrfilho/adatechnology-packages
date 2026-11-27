/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Paginated, PostSummary } from '@adatechnology/content-contracts'
import { useId, type ReactNode } from 'react'

import { PAGE_SIZE_OPTIONS } from '../lib/listUrlState'
import { useContentText } from '../providers/ContentProvider'
import type { RenderSelect } from '../providers/types'
import { Pagination } from './Pagination'
import { SelectField } from './SelectField'

export type PostListFooterProps = {
  readonly data: Paginated<PostSummary>
  readonly pageSize: number
  readonly onPage: (page: number) => void
  readonly onPageSize: (size: number) => void
  readonly renderSelect: RenderSelect | undefined
}

/** Paginação do servidor: "x–y de total", itens por página e navegação. */
export function PostListFooter({ data, pageSize, onPage, onPageSize, renderSelect }: PostListFooterProps): ReactNode {
  const { messages, format } = useContentText()
  const id = useId()
  const { page, total } = data.pagination
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <div className="adc-list-footer">
      <span className="adc-muted" aria-live="polite">
        {format('rangeLabel', { from, to, total })}
      </span>
      <Pagination page={page} totalPages={data.pagination.totalPages} onPageChange={onPage} />
      <SelectField
        id={id}
        label={messages.itemsPerPage}
        value={String(pageSize)}
        options={PAGE_SIZE_OPTIONS.map((size) => ({ id: String(size), label: String(size) }))}
        onChange={(value) => onPageSize(Number(value))}
        renderSelect={renderSelect}
      />
    </div>
  )
}
