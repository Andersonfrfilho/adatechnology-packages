/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Vocabulário visual da tela em um lugar só. Cada uma destas cadeias já aparecia em três ou mais
 * áreas com uma diferença de um token cada — que é exatamente como dois botões primários acabam
 * com raios de borda diferentes na mesma tela.
 */

export const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium min-h-11 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:pointer-events-none'

export const BUTTON_PRIMARY = `${BUTTON_BASE} bg-brand-600 text-white hover:bg-brand-700`

export const BUTTON_SECONDARY = `${BUTTON_BASE} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800`

export const BUTTON_GHOST = `${BUTTON_BASE} text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800`

export const BUTTON_DANGER = `${BUTTON_BASE} text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40`

export const ICON_BUTTON = `${BUTTON_SECONDARY} min-w-11 px-0`

export const FIELD_CONTROL =
  'min-h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'

export const FIELD_LABEL = 'text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'

export const SURFACE_BORDER = 'rounded-xl border border-gray-200 dark:border-gray-800'

export const ROW_STRIPE = 'bg-gray-50 dark:bg-gray-800/40'
