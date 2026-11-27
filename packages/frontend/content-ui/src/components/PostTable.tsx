/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PostSortField, PostSummary } from '@adatechnology/content-contracts'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import type { ReactNode } from 'react'

import { formatPostDate } from '../lib/format'
import type { ContentMessages } from '../locales'
import { useContentText } from '../providers/ContentProvider'
import { CheckBox } from './CheckBox'
import { StatusChip } from './StatusChip'

const SORTABLE_COLUMNS: readonly { readonly field: PostSortField; readonly label: keyof ContentMessages }[] = [
  { field: 'title', label: 'columnTitle' },
  { field: 'status', label: 'columnStatus' },
  { field: 'publishedAt', label: 'columnPublished' },
  { field: 'updatedAt', label: 'columnUpdated' },
]

export type PostTableProps = {
  readonly rows: readonly PostSummary[]
  readonly sort: PostSortField
  readonly order: 'asc' | 'desc'
  readonly onSort: (field: PostSortField) => void
  readonly selectedIds: ReadonlySet<string>
  readonly onToggleSelected: (id: string) => void
  readonly onToggleAll: () => void
  readonly onSelect: (post: PostSummary) => void
  readonly hasActions: boolean
  readonly renderActions: (post: PostSummary) => ReactNode
  readonly isBusy: boolean
}

export function PostTable(props: PostTableProps): ReactNode {
  const { messages, locale } = useContentText()
  const selectedCount = props.rows.filter((row) => props.selectedIds.has(row.id)).length
  const isAll = selectedCount > 0 && selectedCount === props.rows.length
  return (
    <div className="adc-table-wrap" aria-busy={props.isBusy}>
      <table className="adc-table">
        <thead>
          <tr>
            <th scope="col" className="adc-table__check">
              <CheckBox
                checked={isAll}
                isMixed={selectedCount > 0 && !isAll}
                label={messages.selectAll}
                onChange={props.onToggleAll}
              />
            </th>
            {SORTABLE_COLUMNS.map(({ field, label }) => {
              const isActive = props.sort === field
              const Icon = !isActive ? ChevronsUpDown : props.order === 'asc' ? ArrowUp : ArrowDown
              return (
                <th
                  key={field}
                  scope="col"
                  aria-sort={!isActive ? 'none' : props.order === 'asc' ? 'ascending' : 'descending'}
                >
                  <button type="button" className="adc-sort" onClick={() => props.onSort(field)}>
                    {messages[label]}
                    <Icon aria-hidden="true" className="adc-icon" />
                  </button>
                </th>
              )
            })}
            {props.hasActions && <th scope="col">{messages.columnActions}</th>}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((post) => (
            <tr key={post.id} className={props.selectedIds.has(post.id) ? 'is-selected' : undefined}>
              <td className="adc-table__check">
                <CheckBox
                  checked={props.selectedIds.has(post.id)}
                  label={messages.selectRow.replace('{title}', post.title)}
                  onChange={() => props.onToggleSelected(post.id)}
                />
              </td>
              <td>
                <button type="button" className="adc-row-link" onClick={() => props.onSelect(post)}>
                  {post.title}
                </button>
                <span className="adc-muted adc-slug">/{post.slug}</span>
              </td>
              <td>
                <StatusChip status={post.status} isTemplate={post.isTemplate} />
              </td>
              <td>{formatPostDate(post.publishedAt, locale, true)}</td>
              <td>{formatPostDate(post.updatedAt, locale, true)}</td>
              {props.hasActions && <td className="adc-row-actions">{props.renderActions(post)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
