/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ReactNode } from 'react'

const PATHS = {
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  split: 'M3 5h18v14H3V5Zm9 0v14',
  hand: 'M8 13V5a1.5 1.5 0 0 1 3 0v6m0-1V3.5a1.5 1.5 0 0 1 3 0V11m0-4.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L3 14.5a1.5 1.5 0 0 1 2.4-1.7L8 15',
  close: 'm6 6 12 12M18 6 6 18',
  external: 'M14 4h6v6m0-6-9 9M10 6H5v13h13v-5',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name }: { readonly name: IconName }): ReactNode {
  return (
    <svg
      className="spv-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
