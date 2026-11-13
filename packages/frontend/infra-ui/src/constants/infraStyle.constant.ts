/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export const INFRA_PANEL_CARD = 'rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
export const INFRA_FIELD =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
export const INFRA_LABEL = 'mb-1 block text-sm font-medium text-gray-900 dark:text-gray-200'
export const INFRA_HINT = 'mt-1 text-xs text-gray-500 dark:text-gray-400'
export const INFRA_FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400'
export const INFRA_BUTTON_BASE = `inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 ${INFRA_FOCUS_RING}`
export const INFRA_BUTTON_PRIMARY = `${INFRA_BUTTON_BASE} bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-400`
export const INFRA_BUTTON_SECONDARY = `${INFRA_BUTTON_BASE} border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800`
export const INFRA_BUTTON_DANGER = `${INFRA_BUTTON_BASE} bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500`
export const INFRA_ALERT_ERROR =
  'rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'

// Producao: azul da marca, solido. Homologacao: ciano listrado. Luminosidades distintas e padrao distinto.
export const COST_PRODUCTION_FILL = 'fill-brand-600 dark:fill-brand-400'
export const COST_STAGING_BASE_FILL = 'fill-cyan-700 dark:fill-cyan-400'
export const COST_STAGING_STRIPE_FILL = 'fill-white/45 dark:fill-black/40'
export const COST_TRACK_FILL = 'fill-gray-100 dark:fill-gray-800'

// Alvo de toque de 40 px: o <summary> sem altura própria ficava com 20 px, abaixo do mínimo de 24 px do WCAG 2.2.
export const INFRA_DISCLOSURE_SUMMARY =
  'flex min-h-10 cursor-pointer items-center rounded text-sm font-medium text-gray-900 dark:text-gray-100'
