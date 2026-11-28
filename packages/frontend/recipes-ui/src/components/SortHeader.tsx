/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { useRecipesText } from '../providers/RecipesProvider'

export type SortHeaderProps = {
  readonly label: string
  /** `undefined`: coluna não ordenada (neutro). */
  readonly direction: 'asc' | 'desc' | undefined
  readonly onToggle: () => void
}

export function SortHeader({ label, direction, onToggle }: SortHeaderProps) {
  const { messages } = useRecipesText()
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <th scope="col" aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}>
      <button type="button" className="arc-sort" onClick={onToggle}>
        <span>{label}</span>
        <Icon aria-hidden="true" className="arc-icon" />
        {direction ? (
          <span className="arc-visually-hidden">
            {direction === 'asc' ? messages.sortAscending : messages.sortDescending}
          </span>
        ) : null}
      </button>
    </th>
  )
}
