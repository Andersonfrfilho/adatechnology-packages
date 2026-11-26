/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ReactNode } from 'react'

const PATHS = {
  'rotate-left': 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
  'rotate-right': 'M21 12a9 9 0 1 1-3-6.7M21 4v5h-5',
  'flip-horizontal': 'M12 3v18M8 7 3 17h5V7Zm8 0 5 10h-5V7Z',
  'flip-vertical': 'M3 12h18M7 8 17 3v5H7Zm0 8 10 5v-5H7Z',
  crop: 'M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14',
  sliders: 'M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-6h6m2 8h6',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  text: 'M4 6h16M4 12h16M4 18h10',
  check: 'm5 12 5 5 9-10',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  original: 'M4 5h16v14H4V5Zm0 11 5-5 4 4 3-3 4 4',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name }: { readonly name: IconName }): ReactNode {
  return (
    <svg className="aie-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}
