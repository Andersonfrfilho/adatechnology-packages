/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ReactNode } from 'react'

type IntegrationStatusRowProps = {
  readonly label: string
  readonly children: ReactNode
}

export function IntegrationStatusRow({ label, children }: IntegrationStatusRowProps) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  )
}
