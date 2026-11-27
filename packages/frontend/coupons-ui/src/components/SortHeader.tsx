/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { useCouponsText } from '../providers/CouponsProvider'

export type SortHeaderProps = {
  readonly label: string
  /** `undefined`: coluna não ordenada (neutro). */
  readonly direction: 'asc' | 'desc' | undefined
  readonly onToggle: () => void
}

export function SortHeader({ label, direction, onToggle }: SortHeaderProps) {
  const { messages } = useCouponsText()
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <th scope="col" aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}>
      <button type="button" className="acp-sort" onClick={onToggle}>
        <span>{label}</span>
        <Icon aria-hidden="true" className="acp-icon" />
        {direction ? (
          <span className="acp-visually-hidden">
            {direction === 'asc' ? messages.sortAscending : messages.sortDescending}
          </span>
        ) : null}
      </button>
    </th>
  )
}
