/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ReactNode } from 'react'

import { INFRA_PANEL_CARD } from '../constants/infraStyle.constant'

type CostTileProps = {
  readonly label: string
  readonly value: string
  readonly note?: ReactNode
  readonly isWarning?: boolean
}

const WARNING_TONE = 'border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950'

export function CostTile({ label, value, note, isWarning = false }: CostTileProps) {
  return (
    <div className={`${isWarning ? `rounded-lg border ${WARNING_TONE}` : INFRA_PANEL_CARD} space-y-1 p-4`}>
      <dt className="text-xs font-medium text-gray-600 dark:text-gray-300">{label}</dt>
      <dd className="text-xl font-semibold text-gray-900 tabular-nums dark:text-white">{value}</dd>
      {note ? <dd className="text-xs text-gray-600 dark:text-gray-300">{note}</dd> : null}
    </div>
  )
}
